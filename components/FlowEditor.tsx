'use client';
import '@xyflow/react/dist/style.css';
import { useState, useCallback, useRef, useEffect } from 'react';
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
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
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

// ── Neon color tokens ─────────────────────────────────────────────────────────

const NEON: Record<BlockType, {
  border: string; headerBg: string; accent: string; hex: string; minimap: string;
}> = {
  trigger: { border: 'border-yellow-500/60', headerBg: 'bg-yellow-950/60', accent: 'text-yellow-400', hex: '#eab308', minimap: '#ca8a04' },
  text:    { border: 'border-blue-500/60',   headerBg: 'bg-blue-950/60',   accent: 'text-blue-400',   hex: '#3b82f6', minimap: '#2563eb' },
  image:   { border: 'border-purple-500/60', headerBg: 'bg-purple-950/60', accent: 'text-purple-400', hex: '#a855f7', minimap: '#9333ea' },
  video:   { border: 'border-pink-500/60',   headerBg: 'bg-pink-950/60',   accent: 'text-pink-400',   hex: '#ec4899', minimap: '#db2777' },
  audio:   { border: 'border-orange-500/60', headerBg: 'bg-orange-950/60', accent: 'text-orange-400', hex: '#f97316', minimap: '#ea580c' },
  buttons: { border: 'border-emerald-500/60',headerBg: 'bg-emerald-950/60',accent: 'text-emerald-400',hex: '#10b981', minimap: '#059669' },
  delay:   { border: 'border-slate-500/60',  headerBg: 'bg-slate-800/60',  accent: 'text-slate-400',  hex: '#64748b', minimap: '#475569' },
};

// ── Block → React Flow node / edge conversion ─────────────────────────────────

type RFNodeData = { block: FlowBlock };
type RFNode = Node<RFNodeData>;

const NODE_W = 240;
const INIT_Y_SPACING = 180;
const INIT_X = 300;

function blocksToNodes(blocks: FlowBlock[]): RFNode[] {
  return blocks.map((block, i) => ({
    id: block.id,
    type: 'flowNode',
    position: { x: INIT_X, y: i * INIT_Y_SPACING + 60 },
    data: { block },
  }));
}

function blocksToEdges(blocks: FlowBlock[]): Edge[] {
  return blocks.slice(0, -1).map((block, i) => ({
    id: `e__${block.id}__${blocks[i + 1].id}`,
    source: block.id,
    target: blocks[i + 1].id,
    type: 'flowEdge',
    animated: true,
  }));
}

function rfToBlocks(nodes: RFNode[], edges: Edge[]): FlowBlock[] {
  if (!nodes.length) return [];
  const nextMap = new Map(edges.map((e) => [e.source, e.target]));
  const hasIncoming = new Set(edges.map((e) => e.target));
  const root = nodes.find((n) => !hasIncoming.has(n.id));
  if (!root) return [...nodes].sort((a, b) => a.position.y - b.position.y).map((n) => n.data.block);
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
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/70" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Correspondência</label>
        <div className="flex gap-2 flex-wrap">
          {(['contains', 'exact', 'starts'] as const).map((m) => (
            <button key={m} type="button" onClick={() => onChange({ ...block, matchType: m })}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${block.matchType === m ? 'bg-yellow-950/70 border-yellow-600/60 text-yellow-300' : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'}`}>
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
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-purple-500/60" />
      </div>
      {block.type !== 'audio' && (
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Legenda (opcional)</label>
          <input type="text" value={(block as ImageBlock | VideoBlock).caption}
            onChange={(e) => onChange({ ...block, caption: e.target.value } as ImageBlock | VideoBlock)}
            placeholder="Legenda…"
            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/60" />
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
          {block.buttons.length < 6 && (
            <button type="button" onClick={addBtn} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">+ Adicionar</button>
          )}
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
                <button type="button" onClick={() => removeBtn(btn.id)} className="text-red-600 hover:text-red-400 text-base leading-none shrink-0 transition-colors">×</button>
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

// ── Custom node ───────────────────────────────────────────────────────────────

function FlowNodeCard({ data, selected }: NodeProps) {
  const { block } = data as RFNodeData;
  const meta = BLOCK_META[block.type];
  const n = NEON[block.type];

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden cursor-pointer select-none backdrop-blur-sm transition-all duration-150 ${n.border}`}
      style={{
        width: NODE_W,
        background: 'rgba(10, 12, 20, 0.92)',
        boxShadow: selected
          ? `0 0 0 1.5px ${n.hex}99, 0 0 28px 4px ${n.hex}30, 0 8px 32px rgba(0,0,0,0.5)`
          : '0 4px 24px rgba(0,0,0,0.45)',
      }}
    >
      {/* Input handle */}
      {block.type !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Top}
          style={{
            width: 12, height: 12, borderRadius: '50%',
            background: '#0a0c14', border: `2px solid ${n.hex}88`,
            top: -6,
          }}
        />
      )}

      {/* Header */}
      <div className={`px-4 py-3 ${n.headerBg} flex items-center gap-3 border-b ${n.border}`}>
        <div
          className="w-9 h-9 flex items-center justify-center rounded-xl text-lg shrink-0"
          style={{ background: `${n.hex}18`, border: `1px solid ${n.hex}40` }}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${n.accent}`}>{meta.label}</div>
          <div className="text-xs text-gray-400 truncate mt-0.5 leading-tight">{blockSummary(block)}</div>
        </div>
        {block.type === 'trigger' && (
          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0"
            style={{ borderColor: `${n.hex}50`, background: `${n.hex}18`, color: n.hex }}>
            início
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-gray-600 leading-tight">{meta.description}</span>
        {selected && <span className={`text-[10px] font-semibold ${n.accent} shrink-0 ml-2`}>editando</span>}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 12, height: 12, borderRadius: '50%',
          background: '#0a0c14', border: `2px solid ${n.hex}88`,
          bottom: -6,
        }}
      />
    </div>
  );
}

const nodeTypes = { flowNode: FlowNodeCard };

// ── Custom edge with "+" insert button ────────────────────────────────────────

type FlowEdgeData = { onInsert: (sourceId: string, targetId: string) => void; sourceId: string; targetId: string };

function FlowEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const { onInsert, sourceId, targetId } = (data ?? {}) as Partial<FlowEdgeData>;
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <path
        d={edgePath}
        stroke="url(#edgeGrad)"
        strokeWidth={2}
        fill="none"
        strokeOpacity={0.55}
        className="react-flow__edge-path"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <defs>
        <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      {onInsert && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 10,
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              onClick={() => onInsert(sourceId!, targetId!)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-indigo-300 hover:text-white transition-colors"
              style={{
                background: 'rgba(18, 20, 35, 0.95)',
                border: '1px solid rgba(99, 102, 241, 0.5)',
                boxShadow: '0 0 10px rgba(99, 102, 241, 0.3)',
              }}
            >
              +
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
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
      className="flex flex-col h-full border-r border-white/5 transition-all duration-200"
      style={{
        width: collapsed ? 48 : 200,
        background: 'rgba(8, 10, 18, 0.9)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/5 shrink-0">
        {!collapsed && (
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-600">Blocos</p>
        )}
        <button
          onClick={onToggle}
          className="text-gray-600 hover:text-gray-300 transition-colors ml-auto text-xs"
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Block items */}
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
              className="w-full flex items-center gap-3 text-left transition-colors hover:bg-white/5"
              style={{ padding: collapsed ? '8px 12px' : '10px 12px' }}
              title={collapsed ? meta.label : meta.description}
            >
              <div
                className="shrink-0 flex items-center justify-center rounded-lg text-base"
                style={{
                  width: 32, height: 32,
                  background: `${n.hex}14`,
                  border: `1px solid ${n.hex}35`,
                }}
              >
                {meta.icon}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className={`text-xs font-semibold ${n.accent} leading-tight`}>{meta.label}</div>
                  <div className="text-[10px] text-gray-600 leading-tight mt-0.5 line-clamp-1">{meta.description}</div>
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
      className="flex flex-col h-full border-l border-white/5"
      style={{
        width: 288,
        background: 'rgba(8, 10, 18, 0.95)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        className={`flex items-center gap-2.5 px-4 py-3 border-b border-white/5 shrink-0 ${n.headerBg}`}
        style={{ borderBottomColor: `${n.hex}25` }}
      >
        <div
          className="w-8 h-8 flex items-center justify-center rounded-lg text-base shrink-0"
          style={{ background: `${n.hex}18`, border: `1px solid ${n.hex}40` }}
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

      <div className="px-4 py-3 border-t border-white/5 shrink-0">
        <button onClick={onDelete}
          className="w-full px-3 py-2 text-xs text-red-500 border border-red-900/40 rounded-lg hover:bg-red-950/40 transition-colors">
          Remover bloco
        </button>
      </div>
    </div>
  );
}

// ── Inner editor (needs ReactFlowProvider context) ────────────────────────────

interface Props {
  flow: Flow;
  bots: Bot[];
  onBack: () => void;
  onSaved: (flow: Flow) => void;
}

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

  useEffect(() => { setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100); }, [fitView]);

  // Build edges with insert callbacks whenever nodes/edges change
  const makeEdgesWithCallbacks = useCallback((baseEdges: Edge[], currentNodes: RFNode[]) => {
    return baseEdges.map((e) => ({
      ...e,
      type: 'flowEdge',
      animated: true,
      data: {
        sourceId: e.source,
        targetId: e.target,
        onInsert: (sourceId: string, targetId: string) => {
          const block = createBlock('text');
          const srcNode = currentNodes.find((n) => n.id === sourceId);
          const tgtNode = currentNodes.find((n) => n.id === targetId);
          const newX = srcNode ? srcNode.position.x : INIT_X;
          const newY = srcNode && tgtNode ? (srcNode.position.y + tgtNode.position.y) / 2 : (srcNode?.position.y ?? 200) + 100;
          const newNode: RFNode = { id: block.id, type: 'flowNode', position: { x: newX, y: newY }, data: { block } };
          setNodes((nds) => [...nds, newNode]);
          setEdges((eds) => {
            const filtered = eds.filter((ex) => !(ex.source === sourceId && ex.target === targetId));
            return [
              ...filtered,
              { id: `e__${sourceId}__${block.id}`, source: sourceId, target: block.id, type: 'flowEdge', animated: true },
              { id: `e__${block.id}__${targetId}`, source: block.id, target: targetId, type: 'flowEdge', animated: true },
            ];
          });
          setSelectedBlock(block);
        },
      },
    }));
  }, [setNodes, setEdges]);

  const onConnect: OnConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, type: 'flowEdge', animated: true }, eds));
  }, [setEdges]);

  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    if (sel.length === 1) {
      setSelectedBlock((sel[0] as RFNode).data.block);
    } else {
      setSelectedBlock(null);
    }
  }, []);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedBlock((node as RFNode).data.block);
  }, []);

  const updateBlock = useCallback((updated: FlowBlock) => {
    setNodes((nds) =>
      nds.map((n) => n.id === updated.id ? { ...n, data: { ...n.data, block: updated } } : n)
    );
    setSelectedBlock(updated);
  }, [setNodes]);

  const deleteSelectedBlock = useCallback(() => {
    if (!selectedBlock) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedBlock.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedBlock.id && e.target !== selectedBlock.id));
    setSelectedBlock(null);
  }, [selectedBlock, setNodes, setEdges]);

  const addBlock = useCallback((type: BlockType, position?: { x: number; y: number }) => {
    const block = createBlock(type);
    const lastNode = [...nodes].sort((a, b) => b.position.y - a.position.y)[0];
    const pos = position ?? { x: lastNode ? lastNode.position.x : INIT_X, y: lastNode ? lastNode.position.y + INIT_Y_SPACING : 60 };
    const newNode: RFNode = { id: block.id, type: 'flowNode', position: pos, data: { block } };
    setNodes((nds) => {
      if (lastNode) {
        setEdges((eds) => [...eds, {
          id: `e__${lastNode.id}__${block.id}`,
          source: lastNode.id, target: block.id,
          type: 'flowEdge', animated: true,
        }]);
      }
      return [...nds, newNode];
    });
    setSelectedBlock(block);
    setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50);
  }, [nodes, setNodes, setEdges, fitView]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/rftype') as BlockType;
    if (!type) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const block = createBlock(type);
    const newNode: RFNode = { id: block.id, type: 'flowNode', position, data: { block } };
    setNodes((nds) => [...nds, newNode]);
    setSelectedBlock(block);
  }, [screenToFlowPosition, setNodes]);

  const save = async () => {
    if (!flow.name.trim()) { setError('Dê um nome ao fluxo.'); return; }
    setError('');
    setSaving(true);
    const blocks = rfToBlocks(nodes, edges);
    const payload = { ...flow, blocks };
    try {
      const res = await fetch(flow.id ? `/api/flows/${flow.id}` : '/api/flows', {
        method: flow.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? `Erro ${res.status}`); return; }
      const saved = data as Flow;
      setFlow(saved);
      onSaved(saved);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (err) {
      setError(`Rede: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const edgesWithCb = makeEdgesWithCallbacks(edges, nodes);

  return (
    <div
      className="-mx-4 -my-6 flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 105px)' }}
    >
      {/* ── Top bar ── */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0 flex-wrap gap-y-1.5 border-b border-white/5"
        style={{ background: 'rgba(8, 10, 18, 0.95)', backdropFilter: 'blur(12px)' }}
      >
        <button onClick={onBack}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5 shrink-0">
          ← Fluxos
        </button>
        <div className="w-px h-4 bg-white/8 shrink-0" />

        <input
          type="text"
          value={flow.name}
          onChange={(e) => setFlow((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nome do fluxo"
          className="min-w-[120px] max-w-xs bg-transparent border border-white/10 focus:border-indigo-500/50 rounded-lg px-3 py-1.5 text-white text-sm font-medium focus:outline-none"
        />

        {bots.length > 0 && (
          <select value={flow.botId} onChange={(e) => setFlow((f) => ({ ...f, botId: e.target.value }))}
            className="bg-transparent border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50">
            <option value="">— Bot —</option>
            {bots.map((b) => <option key={b.id} value={b.id}>{b.defaultEmoji} {b.name}</option>)}
          </select>
        )}

        <button
          onClick={() => setFlow((f) => ({ ...f, active: !f.active }))}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors shrink-0 ${
            flow.active
              ? 'border-emerald-700/60 text-emerald-300 bg-emerald-950/50'
              : 'border-white/10 text-gray-500 hover:border-white/20'
          }`}>
          {flow.active ? '● Ativo' : '○ Inativo'}
        </button>

        <div className="flex-1" />

        {error && (
          <span className="text-xs text-red-400 bg-red-950/50 border border-red-900/40 rounded-lg px-2.5 py-1 max-w-xs truncate">✗ {error}</span>
        )}

        <span className="text-xs text-gray-700 shrink-0">{nodes.length} bloco{nodes.length !== 1 ? 's' : ''}</span>

        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold rounded-lg transition-all disabled:opacity-50 shrink-0"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: saving ? 'none' : '0 0 20px rgba(99,102,241,0.3)' }}>
          {saving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          <span className="text-white">{savedOk ? '✓ Salvo' : saving ? '…' : 'Salvar'}</span>
        </button>
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left palette */}
        <BlockPalette
          onAdd={(type) => addBlock(type)}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />

        {/* Canvas */}
        <div className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edgesWithCb}
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
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={28}
              size={1}
              color="rgba(255,255,255,0.06)"
            />
            <Controls
              className="rf-controls"
              style={{
                background: 'rgba(12, 15, 26, 0.9)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            />
            <MiniMap
              nodeColor={(n) => {
                const block = (n.data as RFNodeData)?.block;
                return block ? NEON[block.type].minimap : '#334155';
              }}
              maskColor="rgba(6, 8, 16, 0.75)"
              style={{
                background: 'rgba(10, 12, 22, 0.9)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
              }}
            />

            {/* Empty state */}
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="mt-20 text-center select-none pointer-events-none">
                  <div className="text-6xl opacity-10 mb-4">🔀</div>
                  <p className="text-sm text-gray-600 font-medium">Arraste ou clique em um bloco na barra lateral</p>
                  <p className="text-xs text-gray-700 mt-1">Comece com ⚡ Gatilho</p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Right inspector */}
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
  );
}

// ── Export with provider ──────────────────────────────────────────────────────

export default function FlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
