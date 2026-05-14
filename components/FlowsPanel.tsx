'use client';
import { useState, useEffect, useCallback } from 'react';
import { Flow, BLOCK_META } from '@/lib/flow-types';
import { Bot } from '@/lib/types';
import FlowEditor from './FlowEditor';

interface Props {
  bots: Bot[];
}

type View = 'list' | 'editor';

function emptyFlow(): Flow {
  return {
    id: '',
    name: 'Novo Fluxo',
    active: false,
    botId: '',
    blocks: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        active
          ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
          : 'bg-gray-800 text-gray-500 border border-gray-700'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function BlockPreview({ blocks }: { blocks: Flow['blocks'] }) {
  const shown = blocks.slice(0, 5);
  const rest = blocks.length - shown.length;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {shown.map((b) => (
        <span
          key={b.id}
          title={BLOCK_META[b.type].label}
          className="text-sm"
        >
          {BLOCK_META[b.type].icon}
        </span>
      ))}
      {rest > 0 && <span className="text-xs text-gray-600">+{rest}</span>}
      {blocks.length === 0 && <span className="text-xs text-gray-600 italic">sem blocos</span>}
    </div>
  );
}

export default function FlowsPanel({ bots }: Props) {
  const [view, setView] = useState<View>('list');
  const [flows, setFlows] = useState<Flow[]>([]);
  const [editing, setEditing] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchFlows = useCallback(async () => {
    try {
      const res = await fetch('/api/flows');
      if (res.ok) setFlows(await res.json());
    } catch (err) {
      console.error('[FlowsPanel] fetchFlows error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlows(); }, [fetchFlows]);

  const openCreate = () => {
    const f = emptyFlow();
    f.botId = bots[0]?.id ?? '';
    setEditing(f);
    setView('editor');
  };

  const openEdit = (flow: Flow) => {
    setEditing({ ...flow, blocks: [...flow.blocks] });
    setView('editor');
  };

  const handleBack = () => {
    setView('list');
    setEditing(null);
    fetchFlows();
  };

  const handleSaved = (saved: Flow) => {
    setEditing(saved);
    setFlows((prev) => {
      const idx = prev.findIndex((f) => f.id === saved.id);
      if (idx === -1) return [...prev, saved];
      const copy = [...prev];
      copy[idx] = saved;
      return copy;
    });
  };

  const toggleActive = async (flow: Flow, e: React.MouseEvent) => {
    e.stopPropagation();
    setTogglingId(flow.id);
    try {
      const res = await fetch(`/api/flows/${flow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !flow.active }),
      });
      if (res.ok) {
        setFlows((prev) =>
          prev.map((f) => (f.id === flow.id ? { ...f, active: !f.active } : f)),
        );
      }
    } catch (err) {
      console.error('[FlowsPanel] toggleActive error:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const deleteFlow = async (flow: Flow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remover fluxo "${flow.name}"?`)) return;
    try {
      await fetch(`/api/flows/${flow.id}`, { method: 'DELETE' });
      setFlows((prev) => prev.filter((f) => f.id !== flow.id));
    } catch (err) {
      console.error('[FlowsPanel] deleteFlow error:', err);
    }
  };

  // ── Editor view ──────────────────────────────────────────────────────────────
  if (view === 'editor' && editing) {
    return (
      <FlowEditor
        flow={editing}
        bots={bots}
        onBack={handleBack}
        onSaved={handleSaved}
      />
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  const botName = (id: string) => bots.find((b) => b.id === id)?.name ?? '—';
  const activeCount = flows.filter((f) => f.active).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Fluxos de automação
            {flows.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                {flows.length} criado{flows.length !== 1 ? 's' : ''}
                {activeCount > 0 && ` · ${activeCount} ativo${activeCount !== 1 ? 's' : ''}`}
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Automatize respostas do bot baseadas em palavras-chave.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          + Criar Fluxo
        </button>
      </div>

      {/* Bots warning */}
      {bots.length === 0 && (
        <div className="mb-4 text-sm text-yellow-300 bg-yellow-900/30 border border-yellow-700/40 rounded-xl px-4 py-3">
          ⚠️ Nenhum bot cadastrado. Cadastre um bot na aba <strong>Bots</strong> para vincular aos fluxos.
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-16 text-gray-500 text-sm">Carregando fluxos…</div>
      ) : flows.length === 0 ? (
        /* Empty state */
        <div className="text-center py-20 text-gray-500">
          <div className="text-5xl mb-4">🔀</div>
          <p className="text-base font-medium text-gray-400">Nenhum fluxo criado ainda</p>
          <p className="text-sm mt-1 mb-6">
            Crie fluxos para automatizar mensagens, enviar mídia e criar menus com botões.
          </p>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            + Criar primeiro fluxo
          </button>
        </div>
      ) : (
        /* Flow cards grid */
        <div className="grid gap-3 sm:grid-cols-2">
          {flows.map((flow) => (
            <div
              key={flow.id}
              onClick={() => openEdit(flow)}
              className="bg-gray-800 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-gray-500 hover:bg-gray-800/80 transition-all group"
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h3 className="font-medium text-white truncate group-hover:text-emerald-300 transition-colors">
                    {flow.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    🤖 {botName(flow.botId)}
                  </p>
                </div>
                <StatusBadge active={flow.active} />
              </div>

              {/* Block preview */}
              <div className="mb-3">
                <BlockPreview blocks={flow.blocks} />
              </div>

              {/* Card footer */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-700/60">
                <span className="text-xs text-gray-600">
                  {flow.blocks.length} bloco{flow.blocks.length !== 1 ? 's' : ''}
                  {flow.updatedAt > 0 && (
                    <> · {new Date(flow.updatedAt).toLocaleDateString('pt-BR')}</>
                  )}
                </span>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => toggleActive(flow, e)}
                    disabled={togglingId === flow.id}
                    className="px-2.5 py-1 text-xs rounded-lg border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white transition-colors disabled:opacity-40"
                  >
                    {togglingId === flow.id ? '…' : flow.active ? 'Pausar' : 'Ativar'}
                  </button>
                  <button
                    onClick={(e) => deleteFlow(flow, e)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-red-900/50 text-red-500 hover:bg-red-900/30 transition-colors"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
