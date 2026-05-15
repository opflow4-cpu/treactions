'use client';
import { useState, useEffect, useCallback } from 'react';
import { Bot, GlobalConfig, DEFAULT_CONFIG } from '@/lib/types';
import BotsPanel from '@/components/BotsPanel';
import ConfigPanel from '@/components/ConfigPanel';
import LogsPanel from '@/components/LogsPanel';
import SetupPanel from '@/components/SetupPanel';
import FlowsPanel from '@/components/FlowsPanel';
import SchedulesPanel from '@/components/SchedulesPanel';

type Tab = 'bots' | 'flows' | 'schedules' | 'config' | 'logs' | 'setup';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'bots',      label: 'Bots',          icon: '🤖' },
  { id: 'flows',     label: 'Fluxos',        icon: '🔀' },
  { id: 'schedules', label: 'Agendamentos',  icon: '📅' },
  { id: 'config',    label: 'Configurações', icon: '⚙️' },
  { id: 'logs',      label: 'Logs',          icon: '📋' },
  { id: 'setup',     label: 'Como usar',     icon: '📖' },
];

// ── DEBUG temporário ──────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  console.log('[TReactions] TABS carregados:', TABS.length, TABS.map(t => t.id));
  console.log('[TReactions] schedules presente?', TABS.some(t => t.id === 'schedules'));
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('bots');
  const [bots, setBots] = useState<Bot[]>([]);
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_CONFIG);
  const [loadingBots, setLoadingBots] = useState(true);

  const fetchBots = useCallback(async () => {
    const res = await fetch('/api/bots');
    if (res.ok) setBots(await res.json());
    setLoadingBots(false);
  }, []);

  const fetchConfig = useCallback(async () => {
    const res = await fetch('/api/config');
    if (res.ok) setConfig(await res.json());
  }, []);

  useEffect(() => {
    fetchBots();
    fetchConfig();
  }, [fetchBots, fetchConfig]);

  const activeBots = bots.filter((b) => b.active).length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <span className="font-bold text-white text-lg tracking-tight">TReactions</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span
              className={`w-2 h-2 rounded-full ${
                activeBots > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'
              }`}
            />
            <span>
              {loadingBots
                ? '…'
                : activeBots > 0
                ? `${activeBots} bot${activeBots !== 1 ? 's' : ''} ativo${activeBots !== 1 ? 's' : ''}`
                : 'Nenhum bot ativo'}
            </span>
          </div>
        </div>
      </header>

      {/* ── DEBUG: borda laranja + fundo no container, console.log em cada botão ── */}
      <div style={{
        borderBottom: '1px solid #1f2937',
        background: '#111827',
        outline: '2px solid #f97316', // laranja visível — remove depois do diagnóstico
      }}>
        {/* Faixa de diagnóstico — mostra quantas abas foram montadas */}
        <div style={{ background: '#1c1917', padding: '4px 12px', fontSize: 11, color: '#78716c', fontFamily: 'monospace' }}>
          🔍 DEBUG navbar · abas montadas: <strong style={{ color: '#fbbf24' }}>{TABS.length}</strong>
          {' · '}ids: {TABS.map(t => t.id).join(', ')}
        </div>

        {/* Flex wrap — cada botão tem borda própria para rastrear posição */}
        <div style={{ display: 'flex', flexWrap: 'wrap', padding: '0 8px' }}>
          {TABS.map((t) => {
            if (typeof window !== 'undefined') {
              console.log(`[TReactions] renderizando botão: ${t.id}`);
            }
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '11px 14px',
                  fontSize: 14,
                  fontWeight: 500,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: tab === t.id ? '2px solid #10b981' : '2px solid transparent',
                  color: tab === t.id ? '#34d399' : '#6b7280',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  outline: t.id === 'schedules' ? '1px dashed #f97316' : 'none', // destaca o botão Agendamentos
                }}
              >
                {t.icon} {t.label}
                {t.id === 'bots' && bots.length > 0 && ` (${bots.length})`}
              </button>
            );
          })}
        </div>
      </div>
      {/* ── FIM DEBUG ──────────────────────────────────────────────────────────── */}

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {tab === 'bots' && (
          <BotsPanel bots={bots} onRefresh={fetchBots} />
        )}
        {tab === 'flows' && (
          <FlowsPanel bots={bots} />
        )}
        {tab === 'schedules' && (
          <SchedulesPanel bots={bots} />
        )}
        {tab === 'config' && (
          <ConfigPanel config={config} onSaved={setConfig} />
        )}
        {tab === 'logs' && (
          <LogsPanel />
        )}
        {tab === 'setup' && (
          <SetupPanel bots={bots} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 text-center text-xs text-gray-600 py-4">
        TReactions — Bots oficiais do Telegram via BotFather · Webhook · Sem contas pessoais · v2
      </footer>
    </div>
  );
}
