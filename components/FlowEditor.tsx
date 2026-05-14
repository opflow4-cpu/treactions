'use client';
import '@xyflow/react/dist/style.css';
import React, { useState, useCallback, useRef, useContext, createContext, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  BackgroundVariant,
  Panel,
  EdgeLabelRenderer,
  getBezierPath,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type EdgeProps,
  type OnConnect,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import {
  Flow, FlowBlock, BlockType, BLOCK_META, blockSummary, createBlock,
  TriggerBlock, TextBlock, ImageBlock, VideoBlock, AudioBlock, ButtonsBlock, DelayBlock,
} from '@/lib/flow-types';
import { Bot } from '@/lib/types';

// ── Neon tokens ───────────────────────────────────────────────────────────────

const NEON: Record<BlockType, { border: string; headerBg: string; accent: string; hex: string; minimap: string }> = {
  trigger: { border: 'border-amber-500/50',   headerBg: 'bg-amber-950/50',   accent: 'text-amber-400',   hex: '#f59e0b', minimap: '#d97706' },
  text:    { border: 'border-blue-500/50',    headerBg: 'bg-blue-950/50',    accent: 'text-blue-400',    hex: '#3b82f6', minimap: '#2563eb' },
  image:   { border: 'border-violet-500/50',  headerBg: 'bg-violet-950/50',  accent: 'text-violet-400',  hex: '#8b5cf6', minimap: '#7c3aed' },
  video:   { border: 'border-pink-500/50',    headerBg: 'bg-pink-950/50',    accent: 'text-pink-400',    hex: '#ec4899', minimap: '#db2777' },
  audio:   { border: 'border-orange-500/50',  headerBg: 'bg-orange-950/50',  accent: 'text-orange-400',  hex: '#f97316', minimap: '#ea580c' },
  buttons: { border: 'border-emerald-500/50', headerBg: 'bg-emerald-950/50', accent: 'text-emerald-400', hex: '#10b981', minimap: '#059669' },
  delay:   { border: 'border-slate-500/50',   headerBg: 'bg-slate-800/50',   accent: 'text-slate-400',   hex: '#64748b', minimap: '#475569' },
};

// ── Shared editor context (avoids functions in edge data) ─────────────────────

type EditorCtxType = { insertBetween: (sourceId: string, targetId: string) => void };
const EditorCtx = createContext<EditorCtxType>({ insertBetween: () => {} });

// ── React Flow helpers ────────────────────────────────────────────────────────

type RFNodeData = { block: FlowBlock };
type RFNode = Node<RFNodeData>;

const NODE_W   = 248;
const INIT_X   = 260;
const Y_GAP    = 170;

const EDGE_DEFAULTS = {
  type: 'flowEdge',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 18, height: 18 },
} satisfies Partial<Edge>;

function blocksToNodes(blocks: FlowBlock[]): RFNode[] {
  return blocks.map((block, i) => ({
    id: block.id,
    type: 'flowNode',
    position: { x: INIT_X, y: i * Y_GAP + 40 },
    data: { block },
  }));
}

function blocksToEdges(blocks: FlowBlock[]): Edge[] {
  return blocks.slice(0, -1).map((block, i) => ({
    id: `e__${block.id}__${blocks[i + 1].id}`,
    source: block.id,
    target: blocks[i + 1].id,
    ...EDGE_DEFAULTS,
  }));
}

function rfToBlocks(nodes: RFNode[], edges: Edge[]): FlowBlock[] {
  if (!nodes.length) return [];
  const nextMap = new Map(edges.map((e) => [e.source, e.target]));
  const hasIncoming = new Set(edges.map((e) => e.target));
  const root = nodes.find((n) => !hasIncoming.has(n.id))
    ?? [...nodes].sort((a, b) => a.position.y - b.position.y)[0];
  const result: FlowBlock[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = root.id;
  while (cur && !seen.has(cur)) {
    const node = nodes.find((n) => n.id === cur);
    if (!node) break;
    result.push(node.data.block);
    seen.add(cur);
    cur = nextMap.get(cur);
  }
  nodes.filter((n) => !seen.has(n.id))
    .sort((a, b) => a.position.y - b.position.y)
    .forEach((n) => result.push(n.data.block));
  return result;
}

// ── Block editors ─────────────────────────────────────────────────────────────

function TriggerEditor({ block, onChange }: { block: TriggerBlock; onChange: (b: TriggerBlock) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Palavra-chave</label>
        <input type="text" value={block.keyword}
          onChange={(e) => onChange({ ...block, keyword: e.target.value })}
          placeholder="Ex: oi, ajuda, preço…"
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/60" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Correspondência</label>
        <div className="flex gap-2 flex-wrap">
          {(['contains', 'exact', 'starts'] as const).map((m) => (
            <button key={m} type="button" onClick={() => onChange({ ...block, matchType: m })}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${block.matchType === m ? 'bg-amber-950/70 border-amber-600/60 text-amber-300' : 'border-gray-700 text-gray-500 hover:border-gray-600'}`}>
              {m === 'contains' ? 'Contém' : m === 'exact' ? 'Exata' : 'Começa com'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TextEditor({ block, onChange }: { block: TextBlock; onChange: (b: TextBlock) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">
        Mensagem <span className="text-gray-600 ml-1">{block.content.length} chars</span>
      </label>
      <textarea value={block.content} onChange={(e) => onChange({ ...block, content: e.target.value })}
        placeholder="Digite a mensagem que o bot irá enviar…" rows={5}
        className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500/60" />
    </div>
  );
}

function MediaEditor({ block, onChange }: {
  block: ImageBlock | VideoBlock | AudioBlock;
  onChange: (b: ImageBlock | VideoBlock | AudioBlock) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">URL do arquivo</label>
        <input type="url" value={block.url}
          onChange={(e) => onChange({ ...block, url: e.target.value } as typeof block)}
          placeholder="https://…"
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-violet-500/60" />
      </div>
      {block.type !== 'audio' && (
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Legenda (opcional)</label>
          <input type="text" value={(block as ImageBlock | VideoBlock).caption}
            onChange={(e) => onChange({ ...block, caption: e.target.value } as ImageBlock | VideoBlock)}
            placeholder="Legenda…"
            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60" />
        </div>
      )}
    </div>
  );
}

function ButtonsEditor({ block, onChange }: { block: ButtonsBlock; onChange: (b: ButtonsBlock) => void }) {
  const addBtn = () => onChange({ ...block, buttons: [...block.buttons, { id: `btn_${Date.now()}`, label: '', url: '' }] });
  const removeBtn = (id: string) => onChange({ ...block, buttons: block.buttons.filter((b) => b.id !== id) });
  const updateBtn = (id: string, field: 'label' | 'url', value: string) =>
    onChange({ ...block, buttons: block.buttons.map((b) => (b.id === id ? { ...b, [field]: value } : b)) });
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Mensagem</label>
        <textarea value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })}
          rows={2} placeholder="Texto acima dos botões…"
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-emerald-500/60" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400">Botões ({block.buttons.length})</label>
          {block.buttons.length < 6 && <button type="button" onClick={addBtn} className="text-xs text-emerald-400 hover:text-emerald-300">+ Adicionar</button>}
        </div>
        <div className="space-y-2">
          {block.buttons.map((btn, i) => (
            <div key={btn.id} className="flex gap-1.5 items-center">
              <span className="text-[10px] text-gray-700 w-4 shrink-0">{i + 1}.</span>
              <input type="text" value={btn.label} onChange={(e) => updateBtn(btn.id, 'label', e.target.value)}
                placeholder="Rótulo"
                className="flex-1 bg-[#0d1117] border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500/60" />
              <input type="url" value={btn.url} onChange={(e) => updateBtn(btn.id, 'url', e.target.value)}
                placeholder="URL"
                className="flex-1 bg-[#0d1117] border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-emerald-500/60" />
              {block.buttons.length > 1 && (
                <button type="button" onClick={() => removeBtn(btn.id)} className="text-red-600 hover:text-red-400 text-base leading-none shrink-0">×</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const DELAY_PRESETS = [3, 5, 10, 15, 30, 60];
function DelayEditor({ block, onChange }: { block: DelayBlock; onChange: (b: DelayBlock) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {DELAY_PRESETS.map((s) => (
          <button key={s} type="button" onClick={() => onChange({ ...block, seconds: s })}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${block.seconds === s ? 'bg-gray-700 border-gray-500 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
            {s >= 60 ? `${s / 60}min` : `${s}s`}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-400 shrink-0">Personalizado:</label>
        <input type="number" min={1} max={3600} value={block.seconds}
          onChange={(e) => onChange({ ...block, seconds: Math.max(1, Number(e.target.value)) })}
          className="w-20 bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-gray-500" />
        <span className="text-xs text-gray-600">segundos</span>
      </div>
    </div>
  );
}

// ── Custom node card ──────────────────────────────────────────────────────────

function FlowNodeCard({ data, selected }: NodeProps) {
  const { block } = data as RFNodeData;
  const meta = BLOCK_META[block.type];
  const n = NEON[block.type];
  const isFirst = block.type === 'trigger';

  return (
    <div
      className={`relative rounded-2xl border overflow-visible cursor-default select-none ${n.border}`}
      style={{
        width: NODE_W,
        background: 'rgba(9, 11, 20, 0.96)',
        backdropFilter: 'blur(16px)',
        boxShadow: selected
          ? `0 0 0 1.5px ${n.hex}99, 0 0 30px 4px ${n.hex}28, 0 8px 40px rgba(0,0,0,0.6)`
          : `0 0 0 1px ${n.hex}20, 0 6px 28px rgba(0,0,0,0.5)`,
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {/* ── Input handle (top) ── */}
      {!isFirst && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ top: -10, left: '50%', transform: 'translateX(-50%)', background: 'transparent', border: 'none', width: 20, height: 20, cursor: 'crosshair' }}
        >
          <div
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 10, height: 10, borderRadius: '50%',
              background: '#090b14',
              border: `2px solid ${n.hex}`,
              boxShadow: `0 0 8px ${n.hex}60`,
              pointerEvents: 'none',
            }}
          />
        </Handle>
      )}

      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: `linear-gradient(135deg, ${n.hex}12, ${n.hex}06)`, borderBottom: `1px solid ${n.hex}20` }}
      >
        <div
          className="w-9 h-9 flex items-center justify-center rounded-xl text-lg shrink-0"
          style={{ background: `${n.hex}18`, border: `1px solid ${n.hex}35`, boxShadow: `0 0 10px ${n.hex}20` }}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${n.accent}`}>{meta.label}</div>
          <div className="text-xs text-gray-400 truncate mt-0.5 leading-tight max-w-[140px]">{blockSummary(block)}</div>
        </div>
        {isFirst && (
          <span
            className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
            style={{ border: `1px solid ${n.hex}55`, background: `${n.hex}18`, color: n.hex }}
          >
            Início
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        <span className="text-[10px] text-gray-600 leading-tight line-clamp-1 flex-1">{meta.description}</span>
        {selected && <span className={`text-[10px] font-semibold ${n.accent} shrink-0 ml-2`}>● editando</span>}
      </div>

      {/* ── Output handle (bottom) ── */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ bottom: -10, left: '50%', transform: 'translateX(-50%)', background: 'transparent', border: 'none', width: 20, height: 20, cursor: 'crosshair' }}
      >
        <div
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 10, height: 10, borderRadius: '50%',
            background: '#090b14',
            border: `2px solid ${n.hex}`,
            boxShadow: `0 0 8px ${n.hex}60`,
            pointerEvents: 'none',
          }}
        />
      </Handle>
    </div>
  );
}

const nodeTypes = { flowNode: FlowNodeCard };

// ── Custom animated edge with "+" insert button ───────────────────────────────

function FlowEdge({
  id, source, target,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  selected, markerEnd,
}: EdgeProps) {
  const { insertBetween } = useContext(EditorCtx);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enter = () => { if (timerRef.current) clearTimeout(timerRef.current); setHovered(true); };
  const leave = () => { timerRef.current = setTimeout(() => setHovered(false), 130); };

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.35,
  });

  const active = selected || hovered;
  const stroke       = active ? '#818cf8' : '#4f46e5';
  const strokeOpac   = active ? 0.85      : 0.45;
  const strokeW      = active ? 2.5       : 1.5;
  const glowFilter   = active ? 'drop-shadow(0 0 5px #6366f188)' : 'none';

  return (
    <>
      {/* Wide transparent hit area */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={28}
        fill="none"
        style={{ cursor: 'pointer' }}
        onMouseEnter={enter}
        onMouseLeave={leave}
      />

      {/* Visible animated edge */}
      <path
        d={edgePath}
        stroke={stroke}
        strokeWidth={strokeW}
        strokeOpacity={strokeOpac}
        fill="none"
        markerEnd={markerEnd}
        className="flow-edge-animated"
        style={{ filter: glowFilter, transition: 'stroke 0.2s, stroke-width 0.2s, stroke-opacity 0.2s, filter 0.2s' }}
        onMouseEnter={enter}
        onMouseLeave={leave}
      />

      {/* "+" insert button at midpoint */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 20,
            opacity: active ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={enter}
          onMouseLeave={leave}
        >
          <button
            onClick={(e) => { e.stopPropagation(); insertBetween(source, target); }}
            title="Inserir bloco aqui"
            style={{
              width: 22, height: 22,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(10, 12, 24, 0.97)',
              border: '1.5px solid rgba(99,102,241,0.7)',
              color: '#a5b4fc',
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1,
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(99,102,241,0.45)',
              transition: 'box-shadow 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 18px rgba(99,102,241,0.7)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(129,140,248,0.9)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px rgba(99,102,241,0.45)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.7)';
            }}
          >
            +
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = { flowEdge: FlowEdge };

// ── Block palette sidebar ─────────────────────────────────────────────────────

const BLOCK_ORDER: BlockType[] = ['trigger', 'text', 'image', 'video', 'audio', 'buttons', 'delay'];

function BlockPalette({ onAdd, collapsed, onToggle }: {
  onAdd: (type: BlockType) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex flex-col h-full shrink-0 overflow-hidden transition-all duration-200"
      style={{
        width: collapsed ? 52 : 196,
        background: 'rgba(7, 9, 17, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex items-center px-3 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {!collapsed && <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-600 flex-1">Blocos</p>}
        <button onClick={onToggle} className="text-gray-700 hover:text-gray-400 transition-colors text-xs ml-auto" title={collapsed ? 'Expandir' : 'Colapsar'}>
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {BLOCK_ORDER.map((type) => {
          const meta = BLOCK_META[type];
          const n = NEON[type];
          return (
            <button
              key={type}
              onClick={() => onAdd(type)}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/rftype', type)}
              className="w-full flex items-center gap-3 text-left transition-colors"
              style={{ padding: collapsed ? '8px 10px' : '9px 12px' }}
              title={collapsed ? `${meta.label} — ${meta.description}` : meta.description}
            >
              <div
                className="shrink-0 flex items-center justify-center rounded-xl text-lg transition-all"
                style={{
                  width: 34, height: 34,
                  background: `${n.hex}14`,
                  border: `1px solid ${n.hex}30`,
                  boxShadow: `0 0 0 0 ${n.hex}00`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = `${n.hex}22`;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px ${n.hex}30`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = `${n.hex}14`;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 ${n.hex}00`;
                }}
              >
                {meta.icon}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className={`text-xs font-semibold ${n.accent} leading-tight`}>{meta.label}</div>
                  <div className="text-[10px] text-gray-600 leading-tight mt-0.5 truncate">{meta.description}</div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Right inspector panel ─────────────────────────────────────────────────────

function NodeInspector({ block, onUpdate, onDelete, onClose }: {
  block: FlowBlock;
  onUpdate: (b: FlowBlock) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const meta = BLOCK_META[block.type];
  const n = NEON[block.type];

  return (
    <div
      className="flex flex-col h-full shrink-0"
      style={{
        width: 284,
        background: 'rgba(7, 9, 17, 0.97)',
        backdropFilter: 'blur(12px)',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div
        className="flex items-center gap-2.5 px-4 py-3 shrink-0"
        style={{ background: `${n.hex}0e`, borderBottom: `1px solid ${n.hex}22` }}
      >
        <div
          className="w-8 h-8 flex items-center justify-center rounded-xl text-base shrink-0"
          style={{ background: `${n.hex}18`, border: `1px solid ${n.hex}40`, boxShadow: `0 0 10px ${n.hex}20` }}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${n.accent}`}>{meta.label}</div>
          <div className="text-xs text-gray-500 truncate mt-0.5">{meta.description}</div>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none transition-colors ml-1 shrink-0">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {block.type === 'trigger' && <TriggerEditor block={block} onChange={(b) => onUpdate(b)} />}
        {block.type === 'text'    && <TextEditor    block={block} onChange={(b) => onUpdate(b)} />}
        {(block.type === 'image' || block.type === 'video' || block.type === 'audio') && (
          <MediaEditor block={block} onChange={(b) => onUpdate(b)} />
        )}
        {block.type === 'buttons' && <ButtonsEditor block={block} onChange={(b) => onUpdate(b)} />}
        {block.type === 'delay'   && <DelayEditor   block={block} onChange={(b) => onUpdate(b)} />}
      </div>

      <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={onDelete}
          className="w-full px-3 py-2 text-xs text-red-500 rounded-lg transition-colors"
          style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.04)'; }}
        >
          Remover bloco
        </button>
      </div>
    </div>
  );
}

// ── Flow order indicator (left of canvas) ────────────────────────────────────

function FlowStepList({ nodes, edges }: { nodes: RFNode[]; edges: Edge[] }) {
  const ordered = rfToBlocks(nodes, edges);
  if (ordered.length === 0) return null;
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-0 pointer-events-none select-none">
      {ordered.map((block, i) => {
        const n = NEON[block.type];
        const meta = BLOCK_META[block.type];
        return (
          <React.Fragment key={block.id}>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(8,10,20,0.75)', backdropFilter: 'blur(8px)', border: `1px solid ${n.hex}25` }}>
              <span className="text-sm">{meta.icon}</span>
              <span className={`text-[10px] font-semibold ${n.accent}`}>{meta.label}</span>
            </div>
            {i < ordered.length - 1 && (
              <div className="flex justify-center py-0.5">
                <div style={{ width: 1, height: 10, background: `linear-gradient(to bottom, #4f46e560, #7c3aed60)` }} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main inner editor ─────────────────────────────────────────────────────────

interface Props { flow: Flow; bots: Bot[]; onBack: () => void; onSaved: (flow: Flow) => void; }

function FlowEditorInner({ flow: initialFlow, bots, onBack, onSaved }: Props) {
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [flow, setFlow] = useState<Flow>({ ...initialFlow, blocks: [...initialFlow.blocks] });
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(blocksToNodes(flow.blocks));
  const [edges, setEdges, onEdgesChange] = useEdgesState(blocksToEdges(flow.blocks));

  const [selectedBlock, setSelectedBlock] = useState<FlowBlock | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => { setTimeout(() => fitView({ padding: 0.25, duration: 500 }), 120); }, [fitView]);

  // Insert a new Text node between two connected nodes
  const insertBetween = useCallback((sourceId: string, targetId: string) => {
    const block = createBlock('text');
    const srcNode = nodes.find((n) => n.id === sourceId);
    const tgtNode = nodes.find((n) => n.id === targetId);
    const x = srcNode?.position.x ?? INIT_X;
    const y = srcNode && tgtNode ? (srcNode.position.y + tgtNode.position.y) / 2 : (srcNode?.position.y ?? 200) + Y_GAP / 2;
    const newNode: RFNode = { id: block.id, type: 'flowNode', position: { x, y }, data: { block } };

    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => {
      const without = eds.filter((e) => !(e.source === sourceId && e.target === targetId));
      return [
        ...without,
        { id: `e__${sourceId}__${block.id}`, source: sourceId, target: block.id, ...EDGE_DEFAULTS },
        { id: `e__${block.id}__${targetId}`, source: block.id, target: targetId, ...EDGE_DEFAULTS },
      ];
    });
    setSelectedBlock(block);
  }, [nodes, setNodes, setEdges]);

  const editorCtx: EditorCtxType = { insertBetween };

  const onConnect: OnConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, ...EDGE_DEFAULTS }, eds));
  }, [setEdges]);

  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    setSelectedBlock(sel.length === 1 ? (sel[0] as RFNode).data.block : null);
  }, []);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedBlock((node as RFNode).data.block);
  }, []);

  const updateBlock = useCallback((updated: FlowBlock) => {
    setNodes((nds) => nds.map((n) => n.id === updated.id ? { ...n, data: { ...n.data, block: updated } } : n));
    setSelectedBlock(updated);
  }, [setNodes]);

  const deleteSelectedBlock = useCallback(() => {
    if (!selectedBlock) return;
    const id = selectedBlock.id;
    // Re-wire: find predecessor and successor
    const inEdge = edges.find((e) => e.target === id);
    const outEdge = edges.find((e) => e.source === id);
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => {
      const filtered = eds.filter((e) => e.source !== id && e.target !== id);
      if (inEdge && outEdge) {
        filtered.push({ id: `e__${inEdge.source}__${outEdge.target}`, source: inEdge.source, target: outEdge.target, ...EDGE_DEFAULTS });
      }
      return filtered;
    });
    setSelectedBlock(null);
  }, [selectedBlock, edges, setNodes, setEdges]);

  const addBlock = useCallback((type: BlockType, pos?: { x: number; y: number }) => {
    const block = createBlock(type);
    const lastNode = [...nodes].sort((a, b) => b.position.y - a.position.y)[0];
    const position = pos ?? { x: lastNode?.position.x ?? INIT_X, y: (lastNode?.position.y ?? 0) + Y_GAP };
    const newNode: RFNode = { id: block.id, type: 'flowNode', position, data: { block } };
    setNodes((nds) => [...nds, newNode]);
    if (lastNode) {
      setEdges((eds) => [...eds, { id: `e__${lastNode.id}__${block.id}`, source: lastNode.id, target: block.id, ...EDGE_DEFAULTS }]);
    }
    setSelectedBlock(block);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 60);
  }, [nodes, setNodes, setEdges, fitView]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/rftype') as BlockType;
    if (!type) return;
    addBlock(type, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }, [addBlock, screenToFlowPosition]);

  const save = async () => {
    if (!flow.name.trim()) { setError('Dê um nome ao fluxo.'); return; }
    setError('');
    setSaving(true);
    const blocks = rfToBlocks(nodes, edges);
    try {
      const res = await fetch(flow.id ? `/api/flows/${flow.id}` : '/api/flows', {
        method: flow.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...flow, blocks }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? `Erro ${res.status}`); return; }
      setFlow(data as Flow);
      onSaved(data as Flow);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (err) {
      setError(`Rede: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditorCtx.Provider value={editorCtx}>
      <div className="-mx-4 -my-6 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 105px)' }}>

        {/* ── Top bar ── */}
        <div
          className="flex items-center gap-2 px-4 py-2 shrink-0 flex-wrap gap-y-1.5"
          style={{ background: 'rgba(7, 9, 17, 0.97)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5 shrink-0">
            ← Fluxos
          </button>
          <div className="w-px h-4 shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />

          <input type="text" value={flow.name} onChange={(e) => setFlow((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nome do fluxo"
            className="min-w-[120px] max-w-xs bg-transparent text-white text-sm font-medium focus:outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 12px' }} />

          {bots.length > 0 && (
            <select value={flow.botId} onChange={(e) => setFlow((f) => ({ ...f, botId: e.target.value }))}
              className="bg-transparent text-xs text-white focus:outline-none"
              style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 12px' }}>
              <option value="">— Bot —</option>
              {bots.map((b) => <option key={b.id} value={b.id}>{b.defaultEmoji} {b.name}</option>)}
            </select>
          )}

          <button
            onClick={() => setFlow((f) => ({ ...f, active: !f.active }))}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors shrink-0 ${flow.active ? 'text-emerald-300' : 'text-gray-500 hover:text-gray-400'}`}
            style={{ border: flow.active ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.1)', background: flow.active ? 'rgba(16,185,129,0.08)' : 'transparent' }}>
            {flow.active ? '● Ativo' : '○ Inativo'}
          </button>

          <div className="flex-1" />
          {error && <span className="text-xs text-red-400 bg-red-950/50 rounded-lg px-2.5 py-1 max-w-xs truncate" style={{ border: '1px solid rgba(239,68,68,0.3)' }}>✗ {error}</span>}
          <span className="text-xs text-gray-700 shrink-0">{nodes.length} bloco{nodes.length !== 1 ? 's' : ''}</span>

          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-white rounded-lg transition-all disabled:opacity-50 shrink-0"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 20px rgba(99,102,241,0.3)', border: '1px solid rgba(129,140,248,0.3)' }}>
            {saving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {savedOk ? '✓ Salvo' : saving ? '…' : 'Salvar'}
          </button>
        </div>

        {/* ── Main 3-column area ── */}
        <div className="flex flex-1 overflow-hidden">
          <BlockPalette onAdd={addBlock} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />

          {/* Canvas */}
          <div className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              onNodeDoubleClick={onNodeDoubleClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
              style={{ background: 'transparent' }}
              deleteKeyCode="Delete"
              connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 4', strokeOpacity: 0.7 }}
              connectionLineType={'bezier' as never}
            >
              <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(255,255,255,0.055)" />

              <Controls
                style={{
                  background: 'rgba(10,12,22,0.92)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              />

              <MiniMap
                nodeColor={(n) => NEON[(n.data as RFNodeData)?.block?.type ?? 'text'].minimap}
                maskColor="rgba(5,7,14,0.8)"
                style={{
                  background: 'rgba(8,10,20,0.92)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                }}
              />

              {nodes.length === 0 && (
                <Panel position="top-center">
                  <div className="mt-24 text-center select-none pointer-events-none">
                    <div className="text-6xl opacity-[0.07] mb-4">🔀</div>
                    <p className="text-sm text-gray-600">Arraste ou clique em um bloco na barra lateral</p>
                    <p className="text-xs text-gray-700 mt-1">Comece com ⚡ Gatilho</p>
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </div>

          {selectedBlock && (
            <NodeInspector
              block={selectedBlock}
              onUpdate={updateBlock}
              onDelete={deleteSelectedBlock}
              onClose={() => setSelectedBlock(null)}
            />
          )}
        </div>
      </div>
    </EditorCtx.Provider>
  );
}

// ── Export wrapped in ReactFlowProvider ───────────────────────────────────────

export default function FlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
