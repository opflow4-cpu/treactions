'use client';
import { useState, useCallback } from 'react';
import {
  Flow, FlowBlock, BlockType,
  BLOCK_META, blockSummary, createBlock,
  TextBlock, ImageBlock, VideoBlock, AudioBlock,
  ButtonsBlock, DelayBlock, TriggerBlock,
} from '@/lib/flow-types';
import { Bot } from '@/lib/types';

// ── Block editor per type ─────────────────────────────────────────────────────

function TriggerEditor({ block, onChange }: { block: TriggerBlock; onChange: (b: TriggerBlock) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Palavra-chave</label>
        <input
          type="text"
          value={block.keyword}
          onChange={(e) => onChange({ ...block, keyword: e.target.value })}
          placeholder="Ex: oi, ajuda, preço…"
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Tipo de correspondência</label>
        <div className="flex gap-2">
          {(['contains', 'exact', 'starts'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...block, matchType: m })}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                block.matchType === m
                  ? 'bg-yellow-900/60 border-yellow-600 text-yellow-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
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
      <label className="block text-xs text-gray-400 mb-1">
        Mensagem
        <span className="ml-2 text-gray-600">{block.content.length} chars</span>
      </label>
      <textarea
        value={block.content}
        onChange={(e) => onChange({ ...block, content: e.target.value })}
        placeholder="Digite a mensagem que o bot irá enviar…"
        rows={4}
        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

function MediaEditor({
  block,
  onChange,
}: {
  block: ImageBlock | VideoBlock | AudioBlock;
  onChange: (b: ImageBlock | VideoBlock | AudioBlock) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">URL do arquivo</label>
        <input
          type="url"
          value={block.url}
          onChange={(e) => onChange({ ...block, url: e.target.value } as typeof block)}
          placeholder="https://…"
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-purple-500"
        />
      </div>
      {block.type !== 'audio' && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Legenda (opcional)</label>
          <input
            type="text"
            value={(block as ImageBlock | VideoBlock).caption}
            onChange={(e) =>
              onChange({ ...block, caption: e.target.value } as ImageBlock | VideoBlock)
            }
            placeholder="Legenda da mídia…"
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
          />
        </div>
      )}
    </div>
  );
}

function ButtonsEditor({ block, onChange }: { block: ButtonsBlock; onChange: (b: ButtonsBlock) => void }) {
  const addBtn = () =>
    onChange({
      ...block,
      buttons: [
        ...block.buttons,
        { id: `btn_${Date.now()}`, label: '', url: '' },
      ],
    });

  const removeBtn = (btnId: string) =>
    onChange({ ...block, buttons: block.buttons.filter((b) => b.id !== btnId) });

  const updateBtn = (btnId: string, field: 'label' | 'url', value: string) =>
    onChange({
      ...block,
      buttons: block.buttons.map((b) => (b.id === btnId ? { ...b, [field]: value } : b)),
    });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Texto da mensagem</label>
        <textarea
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Mensagem exibida acima dos botões…"
          rows={2}
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400">Botões ({block.buttons.length})</label>
          {block.buttons.length < 6 && (
            <button
              type="button"
              onClick={addBtn}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              + Adicionar botão
            </button>
          )}
        </div>
        <div className="space-y-2">
          {block.buttons.map((btn, i) => (
            <div key={btn.id} className="flex gap-2 items-start">
              <span className="text-xs text-gray-600 mt-2.5 w-4 shrink-0">{i + 1}.</span>
              <input
                type="text"
                value={btn.label}
                onChange={(e) => updateBtn(btn.id, 'label', e.target.value)}
                placeholder="Rótulo"
                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
              <input
                type="url"
                value={btn.url}
                onChange={(e) => updateBtn(btn.id, 'url', e.target.value)}
                placeholder="URL (opcional)"
                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
              />
              {block.buttons.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBtn(btn.id)}
                  className="mt-1.5 text-red-500 hover:text-red-400 text-lg leading-none"
                >
                  ×
                </button>
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
          <button
            key={s}
            type="button"
            onClick={() => onChange({ ...block, seconds: s })}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              block.seconds === s
                ? 'bg-gray-600 border-gray-400 text-white'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {s >= 60 ? `${s / 60}min` : `${s}s`}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-400 whitespace-nowrap">Valor personalizado:</label>
        <input
          type="number"
          min={1}
          max={3600}
          value={block.seconds}
          onChange={(e) => onChange({ ...block, seconds: Math.max(1, Number(e.target.value)) })}
          className="w-24 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-400"
        />
        <span className="text-xs text-gray-500">segundos</span>
      </div>
    </div>
  );
}

// ── Single block card ─────────────────────────────────────────────────────────

function BlockCard({
  block,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  block: FlowBlock;
  index: number;
  total: number;
  onUpdate: (b: FlowBlock) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = BLOCK_META[block.type];

  return (
    <div className="relative">
      {/* Connector line */}
      {index < total - 1 && (
        <div className="absolute left-6 -bottom-3 w-0.5 h-3 bg-gray-700 z-10" />
      )}

      <div className={`bg-gray-800 border rounded-xl overflow-hidden transition-colors ${
        expanded ? 'border-gray-500' : 'border-gray-700 hover:border-gray-600'
      }`}>
        {/* Block header */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="text-xl shrink-0">{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>
                {meta.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate mt-0.5">{blockSummary(block)}</p>
          </div>

          {/* Move + delete */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMove(-1)}
              title="Mover para cima"
              className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-20 transition-colors"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={index === total - 1}
              onClick={() => onMove(1)}
              title="Mover para baixo"
              className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-20 transition-colors"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={onRemove}
              title="Remover bloco"
              className="p-1 text-gray-600 hover:text-red-400 transition-colors ml-1"
            >
              ✕
            </button>
          </div>

          <span className="text-gray-600 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
        </div>

        {/* Expanded editor */}
        {expanded && (
          <div className="border-t border-gray-700 px-4 py-4 bg-gray-900/40">
            {block.type === 'trigger' && (
              <TriggerEditor block={block} onChange={(b) => onUpdate(b)} />
            )}
            {block.type === 'text' && (
              <TextEditor block={block} onChange={(b) => onUpdate(b)} />
            )}
            {(block.type === 'image' || block.type === 'video' || block.type === 'audio') && (
              <MediaEditor block={block} onChange={(b) => onUpdate(b)} />
            )}
            {block.type === 'buttons' && (
              <ButtonsEditor block={block} onChange={(b) => onUpdate(b)} />
            )}
            {block.type === 'delay' && (
              <DelayEditor block={block} onChange={(b) => onUpdate(b)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Block picker ──────────────────────────────────────────────────────────────

const BLOCK_ORDER: BlockType[] = ['trigger', 'text', 'image', 'video', 'audio', 'buttons', 'delay'];

function BlockPicker({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {BLOCK_ORDER.map((type) => {
        const meta = BLOCK_META[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => onAdd(type)}
            title={meta.description}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-lg text-sm transition-colors"
          >
            <span>{meta.icon}</span>
            <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

interface Props {
  flow: Flow;
  bots: Bot[];
  onBack: () => void;
  onSaved: (flow: Flow) => void;
}

export default function FlowEditor({ flow: initialFlow, bots, onBack, onSaved }: Props) {
  const [flow, setFlow] = useState<Flow>({ ...initialFlow, blocks: [...initialFlow.blocks] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const updateBlock = useCallback((index: number, updated: FlowBlock) => {
    setFlow((f) => {
      const blocks = [...f.blocks];
      blocks[index] = updated;
      return { ...f, blocks };
    });
  }, []);

  const removeBlock = useCallback((index: number) => {
    setFlow((f) => ({ ...f, blocks: f.blocks.filter((_, i) => i !== index) }));
  }, []);

  const moveBlock = useCallback((index: number, dir: -1 | 1) => {
    setFlow((f) => {
      const blocks = [...f.blocks];
      const target = index + dir;
      if (target < 0 || target >= blocks.length) return f;
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...f, blocks };
    });
  }, []);

  const addBlock = useCallback((type: BlockType) => {
    setFlow((f) => ({ ...f, blocks: [...f.blocks, createBlock(type)] }));
  }, []);

  const save = async () => {
    if (!flow.name.trim()) { setError('Dê um nome ao fluxo.'); return; }
    setError('');
    setSaving(true);
    try {
      let res: Response;
      if (!flow.id) {
        res = await fetch('/api/flows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flow),
        });
      } else {
        res = await fetch(`/api/flows/${flow.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flow),
        });
      }
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? `Erro ${res.status}`); return; }
      const saved = data as Flow;
      setFlow(saved);
      onSaved(saved);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(`Erro de rede: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors shrink-0"
        >
          ← Voltar
        </button>

        <input
          type="text"
          value={flow.name}
          onChange={(e) => setFlow((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nome do fluxo"
          className="flex-1 min-w-[160px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-emerald-500"
        />

        {/* Bot selector */}
        <select
          value={flow.botId}
          onChange={(e) => setFlow((f) => ({ ...f, botId: e.target.value }))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 min-w-[140px]"
        >
          <option value="">— Bot vinculado —</option>
          {bots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.defaultEmoji} {b.name}
            </option>
          ))}
        </select>

        {/* Active toggle */}
        <button
          type="button"
          onClick={() => setFlow((f) => ({ ...f, active: !f.active }))}
          className={`px-3 py-2 text-xs font-medium rounded-full border transition-colors shrink-0 ${
            flow.active
              ? 'bg-emerald-900/60 border-emerald-600 text-emerald-300'
              : 'bg-gray-800 border-gray-700 text-gray-400'
          }`}
        >
          {flow.active ? '● Ativo' : '○ Inativo'}
        </button>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          {saving && (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
          )}
          {saved ? '✓ Salvo!' : saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-300 bg-red-900/40 border border-red-700/50 rounded-lg px-3 py-2">
          ✗ {error}
        </div>
      )}

      {/* ── Block picker ── */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">
          Adicionar bloco
        </p>
        <BlockPicker onAdd={addBlock} />
      </div>

      {/* ── Canvas ── */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">
          Canvas — {flow.blocks.length} bloco{flow.blocks.length !== 1 ? 's' : ''}
        </p>

        {flow.blocks.length === 0 ? (
          <div className="border-2 border-dashed border-gray-800 rounded-xl py-16 text-center text-gray-600">
            <div className="text-4xl mb-2">🧩</div>
            <p className="text-sm">Clique em um bloco acima para adicioná-lo ao fluxo.</p>
            <p className="text-xs mt-1 text-gray-700">Comece com um ⚡ Gatilho.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {flow.blocks.map((block, i) => (
              <BlockCard
                key={block.id}
                block={block}
                index={i}
                total={flow.blocks.length}
                onUpdate={(b) => updateBlock(i, b)}
                onRemove={() => removeBlock(i)}
                onMove={(dir) => moveBlock(i, dir)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
