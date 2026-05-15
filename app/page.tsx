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

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #1f2937', background: 'rgba(17,24,39,0.3)', position: 'relative' }}>
        {/* full-width scroll container — no max-width wrapper */}
        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'visible',
            /* hide scrollbar cross-browser without any plugin */
            scrollbarWidth: 'none',       /* Firefox */
            msOverflowStyle: 'none',      /* IE/Edge */
            paddingLeft: 16,
            paddingRight: 16,
          }}
          /* WebKit scrollbar — must be a style tag, not inline prop */
        >
          <style>{`.treactions-nav::-webkit-scrollbar{display:none}`}</style>
          <nav
            className="treactions-nav"
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',          /* single row, never wraps */
              alignItems: 'stretch',
              gap: 2,
              minWidth: 'max-content',     /* expands to fit all tabs */
              width: '100%',
            }}
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '12px 14px',
                    fontSize: 14,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    flexGrow: 0,
                    border: 'none',
                    borderBottom: active ? '2px solid #10b981' : '2px solid transparent',
                    background: 'transparent',
                    color: active ? '#34d399' : '#6b7280',
                    cursor: 'pointer',
                    transition: 'color 0.15s, border-color 0.15s',
                    outline: 'none',
                  }}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                  {t.id === 'bots' && bots.length > 0 && (
                    <span style={{
                      fontSize: 11, background: '#374151', color: '#d1d5db',
                      borderRadius: 99, padding: '1px 6px', lineHeight: 1.4,
                    }}>
                      {bots.length}
                    </span>
                  )}
                  {t.id === 'schedules' && (
                    <span style={{
                      fontSize: 10, background: 'rgba(99,102,241,0.2)', color: '#818cf8',
                      borderRadius: 99, padding: '1px 6px', lineHeight: 1.4,
                      border: '1px solid rgba(99,102,241,0.35)',
                    }}>
                      novo
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── DEBUG STRIP — remove after confirming production has schedules ── */}
      <div style={{ background: '#1a1a2e', borderBottom: '2px solid #6366f1', padding: '6px 16px', fontSize: 11, color: '#a5b4fc', fontFamily: 'monospace' }}>
        BUILD DEBUG: schedules enabled — commit 3e5f15d
        &nbsp;|&nbsp;
        Tabs carregadas: {TABS.map(t => t.id).join(', ')}
      </div>
      {/* ── END DEBUG ─────────────────────────────────────────────────────── */}

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
