'use client';
import { useState, useEffect, useCallback } from 'react';
import { Bot, GlobalConfig, DEFAULT_CONFIG } from '@/lib/types';
import BotsPanel from '@/components/BotsPanel';
import ConfigPanel from '@/components/ConfigPanel';
import LogsPanel from '@/components/LogsPanel';
import SetupPanel from '@/components/SetupPanel';

type Tab = 'bots' | 'config' | 'logs' | 'setup';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'bots',   label: 'Bots',          icon: '🤖' },
  { id: 'config', label: 'Configurações', icon: '⚙️' },
  { id: 'logs',   label: 'Logs',          icon: '📋' },
  { id: 'setup',  label: 'Como usar',     icon: '📖' },
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
      <div className="border-b border-gray-800 bg-gray-900/30">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
                {t.id === 'bots' && bots.length > 0 && (
                  <span className="text-xs bg-gray-700 text-gray-300 rounded-full px-1.5 py-0.5 leading-none">
                    {bots.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {tab === 'bots' && (
          <BotsPanel bots={bots} onRefresh={fetchBots} />
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
