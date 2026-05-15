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
  Flow, FlowBlock, BlockType, ButtonsBlock, ButtonOption, ButtonActionType, ButtonAction,
  BLOCK_META, ACTION_META, blockSummary, createBlock, resolveAction, defaultAction,
  TriggerBlock, TextBlock, TypingBlock, ImageBlock, VideoBlock, AudioBlock, DocumentBlock, DelayBlock,
} from '@/lib/flow-types';
import MediaUploadField from './MediaUploadField';
import { Bot } from '@/lib/types';

// ── Neon tokens ───────────────────────────────────────────────────────────────

const NEON: Record<BlockType, { hex: string; minimap: string }> = {
  trigger:  { hex: '#f59e0b', minimap: '#d97706' },
  text:     { hex: '#3b82f6', minimap: '#2563eb' },
  typing:   { hex: '#06b6d4', minimap: '#0891b2' },
  image:    { hex: '#8b5cf6', minimap: '#7c3aed' },
  video:    { hex: '#ec4899', minimap: '#db2777' },
  audio:    { hex: '#f97316', minimap: '#ea580c' },
  document: { hex: '#14b8a6', minimap: '#0d9488' },
  buttons:  { hex: '#10b981', minimap: '#059669' },
  delay:    { hex: '#64748b', minimap: '#475569' },
};

// ── Editor context (shared callbacks, avoids functions in edge data) ───────────

type EditorCtxType = { insertBetween: (sourceId: string, targetId: string) => void };
const EditorCtx = createContext<EditorCtxType>({ insertBetween: () => {} });

// ── React Flow types & helpers ────────────────────────────────────────────────

type RFNodeData = { block: FlowBlock };
type RFNode = Node<RFNodeData>;

const NODE_W    = 248;
const BTN_W     = 272;
const BTN_HDR_H = 58;   // header section of buttons node
const BTN_ROW_H = 40;   // each button row height
const INIT_X    = 260;
const Y_GAP     = 175;

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
  const edges: Edge[] = [];

  for (let i = 0; i < blocks.length - 1; i++) {
    const block = blocks[i];
    // Buttons blocks with branching use per-handle edges instead
    if (block.type === 'buttons' && block.branching && Object.keys(block.branching).length > 0) continue;
    edges.push({
      id: `e__${block.id}__${blocks[i + 1].id}`,
      source: block.id,
      target: blocks[i + 1].id,
      ...EDGE_DEFAULTS,
    });
  }

  // Per-button branching edges
  for (const block of blocks) {
    if (block.type !== 'buttons' || !block.branching) continue;
    for (const [buttonId, targetId] of Object.entries(block.branching)) {
      const btn = block.buttons.find((b) => b.id === buttonId);
      edges.push({
        id: `e__${block.id}__${buttonId}__${targetId}`,
        source: block.id,
        sourceHandle: buttonId,
        target: targetId,
        label: btn?.label ?? '',
        ...EDGE_DEFAULTS,
      });
    }
  }

  return edges;
}

function rfToBlocks(nodes: RFNode[], edges: Edge[]): FlowBlock[] {
  if (!nodes.length) return [];

  // Build the main chain from edges WITHOUT sourceHandle (non-button edges)
  const mainEdges = edges.filter((e) => !e.sourceHandle);
  const nextMap = new Map(mainEdges.map((e) => [e.source, e.target]));
  const hasIncoming = new Set(mainEdges.map((e) => e.target));
  const root = nodes.find((n) => !hasIncoming.has(n.id))
    ?? [...nodes].sort((a, b) => a.position.y - b.position.y)[0];

  const result: FlowBlock[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = root.id;
  while (cur && !seen.has(cur)) {
    const node = nodes.find((n) => n.id === cur);
    if (!node) break;
    result.push({ ...node.data.block });
    seen.add(cur);
    cur = nextMap.get(cur);
  }
  nodes
    .filter((n) => !seen.has(n.id))
    .sort((a, b) => a.position.y - b.position.y)
    .forEach((n) => result.push({ ...n.data.block }));

  // Extract button branching from per-handle edges
  for (const edge of edges) {
    if (!edge.sourceHandle) continue;
    const block = result.find((b) => b.id === edge.source);
    if (block?.type === 'buttons') {
      block.branching = { ...(block.branching ?? {}), [edge.sourceHandle]: edge.target };
    }
  }

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
        placeholder="Digite a mensagem…" rows={5}
        className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500/60" />
    </div>
  );
}


// ── ButtonsEditor — rich action editor ───────────────────────────────────────

const ACTION_ORDER: ButtonActionType[] = [
  'url', 'next_message', 'custom_message', 'send_media', 'add_tag', 'goto_flow', 'dismiss',
];

function ButtonActionEditor({
  action,
  onChange,
  flows,
}: {
  action: ButtonAction;
  onChange: (a: ButtonAction) => void;
  flows: Flow[];
}) {
  return (
    <div className="mt-2 space-y-2">
      {/* Action type pills */}
      <div className="flex flex-wrap gap-1">
        {ACTION_ORDER.map((t) => {
          const m = ACTION_META[t];
          const active = action.type === t;
          return (
            <button key={t} type="button"
              onClick={() => onChange({ type: t })}
              className="px-2 py-0.5 text-[10px] rounded-full border transition-all"
              style={{
                borderColor: active ? m.hex + '80' : 'rgba(75,85,99,0.5)',
                color:       active ? m.hex : '#6b7280',
                background:  active ? m.hex + '14' : 'transparent',
              }}>
              {m.icon} {m.label}
            </button>
          );
        })}
      </div>

      {/* Conditional fields */}
      {action.type === 'url' && (
        <input type="url" value={action.url ?? ''}
          onChange={(e) => onChange({ ...action, url: e.target.value })}
          placeholder="https://…"
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-blue-500/60" />
      )}

      {action.type === 'custom_message' && (
        <textarea value={action.message ?? ''}
          onChange={(e) => onChange({ ...action, message: e.target.value })}
          placeholder="Mensagem enviada ao clicar…" rows={3}
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-emerald-500/60" />
      )}

      {action.type === 'send_media' && (
        <div className="space-y-1.5">
          <select value={action.mediaType ?? 'image'}
            onChange={(e) => onChange({ ...action, mediaType: e.target.value as ButtonAction['mediaType'] })}
            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none">
            <option value="image">🖼 Imagem</option>
            <option value="video">🎬 Vídeo</option>
            <option value="audio">🎵 Áudio</option>
            <option value="file">📎 Arquivo</option>
          </select>
          <input type="url" value={action.mediaUrl ?? ''}
            onChange={(e) => onChange({ ...action, mediaUrl: e.target.value })}
            placeholder="https://… (URL da mídia)"
            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-violet-500/60" />
        </div>
      )}

      {action.type === 'add_tag' && (
        <input type="text" value={action.tag ?? ''}
          onChange={(e) => onChange({ ...action, tag: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
          placeholder="ex: vip, interessado, quente"
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500/60" />
      )}

      {action.type === 'goto_flow' && (
        flows.length > 0 ? (
          <select value={action.flowId ?? ''}
            onChange={(e) => onChange({ ...action, flowId: e.target.value })}
            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-pink-500/60">
            <option value="">— Selecionar fluxo —</option>
            {flows.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-gray-600">Nenhum outro fluxo cadastrado ainda.</p>
        )
      )}

      {action.type === 'next_message' && (
        <p className="text-[11px] text-indigo-400 bg-indigo-950/30 border border-indigo-900/40 rounded-lg px-3 py-2">
          → Conecte o ponto de saída deste botão ao próximo bloco no canvas.
        </p>
      )}

      {action.type === 'dismiss' && (
        <p className="text-[11px] text-gray-500">O botão desaparece após o clique sem ação adicional.</p>
      )}
    </div>
  );
}

function ButtonsEditor({
  block,
  onChange,
  flows,
}: {
  block: ButtonsBlock;
  onChange: (b: ButtonsBlock) => void;
  flows: Flow[];
}) {
  const addBtn = () =>
    onChange({
      ...block,
      buttons: [...block.buttons, { id: `btn_${Date.now()}`, label: '', action: defaultAction() }],
    });

  const removeBtn = (id: string) =>
    onChange({ ...block, buttons: block.buttons.filter((b) => b.id !== id) });

  const updateBtn = (id: string, patch: Partial<ButtonOption>) =>
    onChange({ ...block, buttons: block.buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  return (
    <div className="space-y-4">
      {/* Message text */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Texto da mensagem</label>
        <textarea value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Texto exibido acima dos botões…" rows={2}
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-emerald-500/60" />
      </div>

      {/* Buttons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-400">Botões ({block.buttons.length})</label>
          {block.buttons.length < 8 && (
            <button type="button" onClick={addBtn} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              + Adicionar botão
            </button>
          )}
        </div>

        {block.buttons.map((btn, i) => {
          const action = resolveAction(btn);
          const ameta = ACTION_META[action.type ?? 'url'];
          return (
            <div key={btn.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${ameta.hex}25`, background: `${ameta.hex}06` }}>
              {/* Button header */}
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${ameta.hex}15` }}>
                <span className="text-xs font-bold w-4 text-center shrink-0" style={{ color: ameta.hex }}>{i + 1}</span>
                <input type="text" value={btn.label}
                  onChange={(e) => updateBtn(btn.id, { label: e.target.value })}
                  placeholder={`Rótulo do botão ${i + 1}`}
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-gray-600" />
                {block.buttons.length > 1 && (
                  <button type="button" onClick={() => removeBtn(btn.id)}
                    className="text-gray-700 hover:text-red-400 transition-colors text-base leading-none shrink-0">×</button>
                )}
              </div>
              {/* Action editor */}
              <div className="px-3 py-2.5">
                <ButtonActionEditor
                  action={action}
                  onChange={(a) => updateBtn(btn.id, { action: a })}
                  flows={flows}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TYPING_PRESETS = [2, 3, 5, 10];

function TypingEditor({ block, onChange }: { block: TypingBlock; onChange: (b: TypingBlock) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 leading-relaxed">
        Mostra &quot;digitando…&quot; no Telegram antes de enviar a próxima mensagem.
        Para durações acima de 5s o indicador é renovado automaticamente.
      </p>
      <div className="flex gap-2 flex-wrap">
        {TYPING_PRESETS.map((s) => (
          <button key={s} type="button" onClick={() => onChange({ ...block, seconds: s })}
            className="px-3 py-1 text-xs rounded-full border transition-colors"
            style={block.seconds === s
              ? { background: 'rgba(6,182,212,0.12)', borderColor: 'rgba(6,182,212,0.6)', color: '#67e8f9' }
              : { borderColor: 'rgba(75,85,99,0.5)', color: '#6b7280' }}>
            {s}s
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-400 shrink-0">Personalizado:</label>
        <input type="number" min={1} max={25} value={block.seconds}
          onChange={(e) => onChange({ ...block, seconds: Math.max(1, Math.min(25, Number(e.target.value))) })}
          className="w-20 bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-500/60" />
        <span className="text-xs text-gray-600">segundos (máx 25s)</span>
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
        <input type="number" min={1} max={300} value={block.seconds}
          onChange={(e) => onChange({ ...block, seconds: Math.max(1, Number(e.target.value)) })}
          className="w-20 bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none" />
        <span className="text-xs text-gray-600">segundos (máx 25s ao vivo)</span>
      </div>
    </div>
  );
}

// ── Custom node — regular blocks ──────────────────────────────────────────────

function RegularNodeCard({ block, selected }: { block: FlowBlock; selected: boolean }) {
  const meta = BLOCK_META[block.type];
  const { hex } = NEON[block.type];
  const isFirst = block.type === 'trigger';

  return (
    <div
      style={{
        width: NODE_W,
        background: 'rgba(9,11,20,0.96)',
        backdropFilter: 'blur(16px)',
        borderRadius: 16,
        border: `1px solid ${hex}${selected ? '80' : '40'}`,
        boxShadow: selected
          ? `0 0 0 1.5px ${hex}99, 0 0 28px 4px ${hex}28, 0 8px 36px rgba(0,0,0,0.6)`
          : `0 0 0 1px ${hex}20, 0 5px 24px rgba(0,0,0,0.5)`,
        overflow: 'visible',
        position: 'relative',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {!isFirst && (
        <Handle type="target" position={Position.Top}
          style={{ top: -6, left: '50%', transform: 'translateX(-50%)', background: '#090b14', border: `2px solid ${hex}`, boxShadow: `0 0 8px ${hex}60`, width: 12, height: 12, borderRadius: '50%' }} />
      )}
      <div style={{ padding: '12px 16px', background: `linear-gradient(135deg, ${hex}12, ${hex}06)`, borderBottom: `1px solid ${hex}18`, borderRadius: '16px 16px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: `${hex}18`, border: `1px solid ${hex}35`, fontSize: 18, flexShrink: 0 }}>
            {meta.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.14em', color: hex }}>{meta.label}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 156 }}>{blockSummary(block)}</div>
          </div>
          {isFirst && (
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 99, border: `1px solid ${hex}55`, background: `${hex}18`, color: hex, flexShrink: 0 }}>início</span>
          )}
          {selected && !isFirst && <span style={{ fontSize: 10, fontWeight: 600, color: hex, flexShrink: 0 }}>● edit</span>}
        </div>
      </div>
      <div style={{ padding: '8px 16px 10px' }}>
        <span style={{ fontSize: 10, color: '#4b5563', lineHeight: 1.3 }}>{meta.description}</span>
      </div>
      <Handle type="source" position={Position.Bottom}
        style={{ bottom: -6, left: '50%', transform: 'translateX(-50%)', background: '#090b14', border: `2px solid ${hex}`, boxShadow: `0 0 8px ${hex}60`, width: 12, height: 12, borderRadius: '50%' }} />
    </div>
  );
}

// ── Custom node — buttons block (per-button handles) ──────────────────────────

function ButtonsNodeCard({ block, selected }: { block: ButtonsBlock; selected: boolean }) {
  const { hex } = NEON.buttons;
  const totalH = BTN_HDR_H + 1 + block.buttons.length * BTN_ROW_H;

  return (
    <div
      style={{
        width: BTN_W,
        height: totalH,
        position: 'relative',
        background: 'rgba(9,11,20,0.96)',
        backdropFilter: 'blur(16px)',
        borderRadius: 16,
        border: `1px solid ${hex}${selected ? '80' : '40'}`,
        boxShadow: selected
          ? `0 0 0 1.5px ${hex}99, 0 0 28px 4px ${hex}28, 0 8px 36px rgba(0,0,0,0.6)`
          : `0 0 0 1px ${hex}20, 0 5px 24px rgba(0,0,0,0.5)`,
        overflow: 'visible',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {/* Input handle at top center */}
      <Handle type="target" position={Position.Top}
        style={{ top: -6, left: '50%', transform: 'translateX(-50%)', background: '#090b14', border: `2px solid ${hex}`, boxShadow: `0 0 8px ${hex}60`, width: 12, height: 12, borderRadius: '50%' }} />

      {/* Per-button source handles — rendered on node root for correct absolute positioning */}
      {block.buttons.map((btn, i) => {
        const action = resolveAction(btn);
        const ameta = ACTION_META[action.type ?? 'url'];
        const topCenter = BTN_HDR_H + 1 + i * BTN_ROW_H + BTN_ROW_H / 2;
        return (
          <Handle
            key={`sh-${btn.id}`}
            type="source"
            position={Position.Right}
            id={btn.id}
            style={{
              position: 'absolute',
              top: topCenter,
              right: -7,
              transform: 'translateY(-50%)',
              background: '#090b14',
              border: `2px solid ${ameta.hex}`,
              boxShadow: `0 0 10px ${ameta.hex}55`,
              width: 13,
              height: 13,
              borderRadius: '50%',
            }}
          />
        );
      })}

      {/* Header */}
      <div style={{
        height: BTN_HDR_H,
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
        background: `linear-gradient(135deg, ${hex}12, ${hex}06)`,
        borderBottom: `1px solid ${hex}18`,
        borderRadius: '16px 16px 0 0',
      }}>
        <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: `${hex}18`, border: `1px solid ${hex}35`, fontSize: 18, flexShrink: 0 }}>
          🔘
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.14em', color: hex }}>Botões</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {block.text ? block.text.slice(0, 30) + (block.text.length > 30 ? '…' : '') : `${block.buttons.length} opção(ões)`}
          </div>
        </div>
        {selected && <span style={{ fontSize: 10, fontWeight: 600, color: hex, flexShrink: 0 }}>● edit</span>}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: `${hex}18` }} />

      {/* Button rows */}
      {block.buttons.map((btn, i) => {
        const action = resolveAction(btn);
        const ameta = ACTION_META[action.type ?? 'url'];
        const isLast = i === block.buttons.length - 1;
        return (
          <div key={btn.id} style={{
            height: BTN_ROW_H,
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 36px 0 14px',
            borderBottom: isLast ? 'none' : `1px solid ${hex}10`,
          }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>{ameta.icon}</span>
            <span style={{ flex: 1, fontSize: 12, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {btn.label || <span style={{ color: '#374151' }}>Botão {i + 1}</span>}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, color: ameta.hex, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {ameta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FlowNodeCard({ data, selected }: NodeProps) {
  const { block } = data as RFNodeData;
  if (block.type === 'buttons') {
    return <ButtonsNodeCard block={block} selected={selected ?? false} />;
  }
  return <RegularNodeCard block={block} selected={selected ?? false} />;
}

const nodeTypes = { flowNode: FlowNodeCard };

// ── Custom animated edge with hover "+" ──────────────────────────────────────

function FlowEdge({ source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, markerEnd, label }: EdgeProps) {
  const { insertBetween } = useContext(EditorCtx);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enter = () => { if (timerRef.current) clearTimeout(timerRef.current); setHovered(true); };
  const leave = () => { timerRef.current = setTimeout(() => setHovered(false), 130); };

  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature: 0.35 });
  const active = selected || hovered;

  return (
    <>
      <path d={edgePath} stroke="transparent" strokeWidth={28} fill="none" onMouseEnter={enter} onMouseLeave={leave} style={{ cursor: 'pointer' }} />
      <path d={edgePath} stroke={active ? '#818cf8' : '#4f46e5'} strokeWidth={active ? 2.5 : 1.5}
        strokeOpacity={active ? 0.85 : 0.45} fill="none" markerEnd={markerEnd}
        className="flow-edge-animated"
        style={{ filter: active ? 'drop-shadow(0 0 5px #6366f188)' : 'none', transition: 'stroke 0.2s, stroke-width 0.2s, filter 0.2s' }}
        onMouseEnter={enter} onMouseLeave={leave} />

      {/* Edge label (button name for button-source edges) */}
      {label && (
        <EdgeLabelRenderer>
          <div style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'none',
            background: 'rgba(10,12,24,0.9)',
            border: '1px solid rgba(99,102,241,0.35)',
            borderRadius: 6,
            padding: '2px 7px',
            fontSize: 10,
            fontWeight: 600,
            color: '#a5b4fc',
            whiteSpace: 'nowrap',
          }}>
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* "+" insert button */}
      <EdgeLabelRenderer>
        <div
          style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX + (label ? 0 : 0)}px, ${labelY + (label ? 22 : 0)}px)`, pointerEvents: 'all', zIndex: 20, opacity: active ? 1 : 0, transition: 'opacity 0.15s ease' }}
          onMouseEnter={enter} onMouseLeave={leave}
        >
          <button
            onClick={(e) => { e.stopPropagation(); insertBetween(source, target); }}
            style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,12,24,0.97)', border: '1.5px solid rgba(99,102,241,0.7)', color: '#a5b4fc', fontSize: 14, fontWeight: 700, lineHeight: 1, cursor: 'pointer', boxShadow: '0 0 12px rgba(99,102,241,0.45)' }}
          >+</button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = { flowEdge: FlowEdge };

// ── Block palette sidebar ─────────────────────────────────────────────────────

const BLOCK_ORDER: BlockType[] = ['trigger', 'text', 'typing', 'image', 'video', 'audio', 'document', 'buttons', 'delay'];

function BlockPalette({ onAdd, collapsed, onToggle }: { onAdd: (t: BlockType) => void; collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-col h-full shrink-0 overflow-hidden transition-all duration-200"
      style={{ width: collapsed ? 52 : 196, background: 'rgba(7,9,17,0.95)', backdropFilter: 'blur(12px)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center px-3 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {!collapsed && <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-600 flex-1">Blocos</p>}
        <button onClick={onToggle} className="text-gray-700 hover:text-gray-400 transition-colors text-xs ml-auto">{collapsed ? '›' : '‹'}</button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {BLOCK_ORDER.map((type) => {
          const meta = BLOCK_META[type];
          const { hex } = NEON[type];
          return (
            <button key={type} onClick={() => onAdd(type)} draggable
              onDragStart={(e) => e.dataTransfer.setData('application/rftype', type)}
              className="w-full flex items-center gap-3 text-left transition-colors hover:bg-white/5"
              style={{ padding: collapsed ? '8px 10px' : '9px 12px' }}
              title={collapsed ? `${meta.label} — ${meta.description}` : meta.description}>
              <div className="shrink-0 flex items-center justify-center rounded-xl text-lg"
                style={{ width: 34, height: 34, background: `${hex}14`, border: `1px solid ${hex}30` }}>
                {meta.icon}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-semibold leading-tight" style={{ color: hex }}>{meta.label}</div>
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

function NodeInspector({ block, onUpdate, onDelete, onClose, flows }: {
  block: FlowBlock; onUpdate: (b: FlowBlock) => void;
  onDelete: () => void; onClose: () => void; flows: Flow[];
}) {
  const meta = BLOCK_META[block.type];
  const { hex } = NEON[block.type];

  return (
    <div className="flex flex-col h-full shrink-0"
      style={{ width: 292, background: 'rgba(7,9,17,0.97)', backdropFilter: 'blur(12px)', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center gap-2.5 px-4 py-3 shrink-0"
        style={{ background: `${hex}0e`, borderBottom: `1px solid ${hex}22` }}>
        <div className="w-8 h-8 flex items-center justify-center rounded-xl text-base shrink-0"
          style={{ background: `${hex}18`, border: `1px solid ${hex}40`, boxShadow: `0 0 10px ${hex}20` }}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: hex }}>{meta.label}</div>
          <div className="text-xs text-gray-500 truncate mt-0.5">{meta.description}</div>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl leading-none transition-colors ml-1 shrink-0">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {block.type === 'trigger' && <TriggerEditor block={block} onChange={(b) => onUpdate(b)} />}
        {block.type === 'text'    && <TextEditor    block={block} onChange={(b) => onUpdate(b)} />}
        {block.type === 'typing'  && <TypingEditor  block={block as TypingBlock} onChange={(b) => onUpdate(b)} />}
        {block.type === 'image' && (
          <MediaUploadField
            kind="image"
            url={(block as ImageBlock).url}
            caption={(block as ImageBlock).caption}
            onUrlChange={(u) => onUpdate({ ...(block as ImageBlock), url: u })}
            onCaptionChange={(c) => onUpdate({ ...(block as ImageBlock), caption: c })}
          />
        )}
        {block.type === 'video' && (
          <MediaUploadField
            kind="video"
            url={(block as VideoBlock).url}
            caption={(block as VideoBlock).caption}
            onUrlChange={(u) => onUpdate({ ...(block as VideoBlock), url: u })}
            onCaptionChange={(c) => onUpdate({ ...(block as VideoBlock), caption: c })}
          />
        )}
        {block.type === 'audio' && (
          <MediaUploadField
            kind="audio"
            url={(block as AudioBlock).url}
            onUrlChange={(u) => onUpdate({ ...(block as AudioBlock), url: u })}
          />
        )}
        {block.type === 'document' && (
          <MediaUploadField
            kind="file"
            url={(block as DocumentBlock).url}
            caption={(block as DocumentBlock).caption}
            onUrlChange={(u) => onUpdate({ ...(block as DocumentBlock), url: u })}
            onCaptionChange={(c) => onUpdate({ ...(block as DocumentBlock), caption: c })}
          />
        )}
        {block.type === 'buttons' && (
          <ButtonsEditor
            block={block}
            onChange={(b) => onUpdate(b)}
            flows={flows.filter((f) => f.id !== block.id)}
          />
        )}
        {block.type === 'delay' && <DelayEditor block={block} onChange={(b) => onUpdate(b)} />}
      </div>

      <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={onDelete}
          className="w-full px-3 py-2 text-xs text-red-500 rounded-lg transition-colors"
          style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)' }}>
          Remover bloco
        </button>
      </div>
    </div>
  );
}

// ── Inner editor (uses ReactFlowProvider context) ─────────────────────────────

interface Props {
  flow: Flow;
  bots: Bot[];
  flows?: Flow[];
  onBack: () => void;
  onSaved: (flow: Flow) => void;
}

function FlowEditorInner({ flow: initialFlow, bots, flows = [], onBack, onSaved }: Props) {
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [flow, setFlow]     = useState<Flow>({ ...initialFlow, blocks: [...initialFlow.blocks] });
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(blocksToNodes(flow.blocks));
  const [edges, setEdges, onEdgesChange] = useEdgesState(blocksToEdges(flow.blocks));
  const [selectedBlock, setSelectedBlock] = useState<FlowBlock | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => { setTimeout(() => fitView({ padding: 0.25, duration: 500 }), 120); }, [fitView]);

  const insertBetween = useCallback((sourceId: string, targetId: string) => {
    const block = createBlock('text');
    const srcNode = nodes.find((n) => n.id === sourceId);
    const tgtNode = nodes.find((n) => n.id === targetId);
    const x   = srcNode?.position.x ?? INIT_X;
    const y   = srcNode && tgtNode ? (srcNode.position.y + tgtNode.position.y) / 2 : (srcNode?.position.y ?? 200) + Y_GAP / 2;
    const newNode: RFNode = { id: block.id, type: 'flowNode', position: { x, y }, data: { block } };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => {
      const filtered = eds.filter((e) => !(e.source === sourceId && e.target === targetId));
      return [
        ...filtered,
        { id: `e__${sourceId}__${block.id}`, source: sourceId, target: block.id, ...EDGE_DEFAULTS },
        { id: `e__${block.id}__${targetId}`, source: block.id, target: targetId, ...EDGE_DEFAULTS },
      ];
    });
    setSelectedBlock(block);
  }, [nodes, setNodes, setEdges]);

  const onConnect: OnConnect = useCallback((params: Connection) => {
    const src = nodes.find((n) => n.id === params.source);
    const edgeBase = { ...params, ...EDGE_DEFAULTS };
    if (src?.data.block.type === 'buttons' && params.sourceHandle) {
      const btn = (src.data.block as ButtonsBlock).buttons.find((b) => b.id === params.sourceHandle);
      setEdges((eds) => addEdge({ ...edgeBase, label: btn?.label ?? '', id: `e__${params.source}__${params.sourceHandle}__${params.target}` }, eds));
    } else {
      setEdges((eds) => addEdge(edgeBase, eds));
    }
  }, [nodes, setEdges]);

  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    setSelectedBlock(sel.length === 1 ? (sel[0] as RFNode).data.block : null);
  }, []);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedBlock((node as RFNode).data.block);
  }, []);

  const updateBlock = useCallback((updated: FlowBlock) => {
    setNodes((nds) => nds.map((n) => n.id === updated.id ? { ...n, data: { ...n.data, block: updated } } : n));
    setSelectedBlock(updated);
    // Update button labels on connected edges when buttons block changes
    if (updated.type === 'buttons') {
      setEdges((eds) => eds.map((e) => {
        if (e.source !== updated.id || !e.sourceHandle) return e;
        const btn = updated.buttons.find((b) => b.id === e.sourceHandle);
        return btn ? { ...e, label: btn.label } : e;
      }));
    }
  }, [setNodes, setEdges]);

  const deleteSelectedBlock = useCallback(() => {
    if (!selectedBlock) return;
    const id = selectedBlock.id;
    const inEdge  = edges.find((e) => e.target === id && !e.sourceHandle);
    const outEdge = edges.find((e) => e.source === id && !e.sourceHandle);
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
    setNodes((nds) => [...nds, { id: block.id, type: 'flowNode', position, data: { block } }]);
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

  const editorCtx: EditorCtxType = { insertBetween };

  return (
    <EditorCtx.Provider value={editorCtx}>
      <div className="-mx-4 -my-6 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 105px)' }}>

        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2 shrink-0 flex-wrap gap-y-1.5"
          style={{ background: 'rgba(7,9,17,0.97)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5 shrink-0">← Fluxos</button>
          <div className="w-px h-4 shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <input type="text" value={flow.name} onChange={(e) => setFlow((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nome do fluxo" className="min-w-[120px] max-w-xs bg-transparent text-white text-sm font-medium focus:outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 12px' }} />
          {bots.length > 0 && (
            <select value={flow.botId} onChange={(e) => setFlow((f) => ({ ...f, botId: e.target.value }))}
              className="bg-transparent text-xs text-white focus:outline-none"
              style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 12px' }}>
              <option value="">— Bot —</option>
              {bots.map((b) => <option key={b.id} value={b.id}>{b.defaultEmoji} {b.name}</option>)}
            </select>
          )}
          <button onClick={() => setFlow((f) => ({ ...f, active: !f.active }))}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors shrink-0 ${flow.active ? 'text-emerald-300' : 'text-gray-500 hover:text-gray-400'}`}
            style={{ border: flow.active ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.1)', background: flow.active ? 'rgba(16,185,129,0.08)' : 'transparent' }}>
            {flow.active ? '● Ativo' : '○ Inativo'}
          </button>
          <div className="flex-1" />
          {error && <span className="text-xs text-red-400 bg-red-950/50 rounded-lg px-2.5 py-1 max-w-xs truncate" style={{ border: '1px solid rgba(239,68,68,0.3)' }}>✗ {error}</span>}
          <span className="text-xs text-gray-700 shrink-0">{nodes.length} bloco{nodes.length !== 1 ? 's' : ''}</span>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-white rounded-lg disabled:opacity-50 shrink-0"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 20px rgba(99,102,241,0.3)', border: '1px solid rgba(129,140,248,0.3)' }}>
            {saving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {savedOk ? '✓ Salvo' : saving ? '…' : 'Salvar'}
          </button>
        </div>

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden">
          <BlockPalette onAdd={addBlock} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />

          <div className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onConnect={onConnect} onSelectionChange={onSelectionChange} onNodeDoubleClick={onNodeDoubleClick}
              nodeTypes={nodeTypes} edgeTypes={edgeTypes}
              fitView proOptions={{ hideAttribution: true }}
              style={{ background: 'transparent' }} deleteKeyCode="Delete"
              connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 4', strokeOpacity: 0.7 }}
            >
              <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(255,255,255,0.055)" />
              <Controls style={{ background: 'rgba(10,12,22,0.92)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }} />
              <MiniMap
                nodeColor={(n) => NEON[(n.data as RFNodeData)?.block?.type ?? 'text'].minimap}
                maskColor="rgba(5,7,14,0.8)"
                style={{ background: 'rgba(8,10,20,0.92)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}
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
              block={selectedBlock} onUpdate={updateBlock}
              onDelete={deleteSelectedBlock} onClose={() => setSelectedBlock(null)}
              flows={flows}
            />
          )}
        </div>
      </div>
    </EditorCtx.Provider>
  );
}

export default function FlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
