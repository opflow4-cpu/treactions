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

// ── EXTREME DEBUG — log TABS on every render ────────────────────────────────
if (typeof window !== 'undefined') {
  console.log('TABS DEBUG', TABS);
  console.log('TABS has schedules?', TABS.some(t => t.id === 'schedules'));
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

      {/* ████ DEBUG NAVBAR NOVA ████ */}
      <div style={{ background: '#7c3aed', color: '#fff', textAlign: 'center', padding: '10px', fontSize: 18, fontWeight: 900, letterSpacing: 2 }}>
        ✅ DEBUG NAVBAR NOVA — commit ea58e03+
      </div>

      {/* Tab bar — zero legacy CSS, plain flex */}
      <div style={{ borderBottom: '1px solid #1f2937', background: '#111827' }}>
        <div style={{ display: 'flex', overflowX: 'auto', gap: 4, padding: '0 16px' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flexShrink: 0,
                whiteSpace: 'nowrap',
                padding: '12px 14px',
                fontSize: 14,
                fontWeight: 500,
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid #10b981' : '2px solid transparent',
                color: tab === t.id ? '#34d399' : '#6b7280',
                cursor: 'pointer',
              }}
            >
              {t.icon} {t.label}
              {t.id === 'bots' && bots.length > 0 && ` (${bots.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ══ EXTREME DEBUG — commit 542f3a2 ══════════════════════════════════ */}
      <div style={{ background: '#0f172a', border: '2px solid #f59e0b', margin: 8, borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
        <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 6 }}>
          🔍 DEBUG — commit 542f3a2
        </div>
        <div style={{ color: '#94a3b8', marginBottom: 4 }}>
          TABS.length = <strong style={{ color: '#fff' }}>{TABS.length}</strong>
          &nbsp;|&nbsp;
          schedules presente? <strong style={{ color: TABS.some(t => t.id === 'schedules') ? '#4ade80' : '#f87171' }}>
            {TABS.some(t => t.id === 'schedules') ? 'SIM ✓' : 'NÃO ✗'}
          </strong>
        </div>
        <div style={{ color: '#64748b', marginBottom: 8, wordBreak: 'break-all' }}>
          JSON: {JSON.stringify(TABS.map(t => t.id))}
        </div>
        {/* botão hardcoded fora do map — se este aparecer mas o menu não, é CSS */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#64748b', fontSize: 11 }}>Botões hardcoded:</span>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                background: tab === t.id ? '#6366f1' : '#1e293b',
                color: tab === t.id ? '#fff' : '#94a3b8',
                border: '1px solid #334155',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>
      {/* ══ END EXTREME DEBUG ═══════════════════════════════════════════════ */}

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
        TReactions — Bots oficiais do Telegram via BotFather · Webhook · Sem contas pessoais
      </footer>
    </div>
  );
}
