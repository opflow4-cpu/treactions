'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, GitBranch, SlidersHorizontal, Activity, BookOpen } from 'lucide-react';
import { Bot as BotType, GlobalConfig, DEFAULT_CONFIG } from '@/lib/types';
import Sidebar, { Tab } from '@/components/Sidebar';
import BotsPanel   from '@/components/BotsPanel';
import ConfigPanel from '@/components/ConfigPanel';
import LogsPanel   from '@/components/LogsPanel';
import SetupPanel  from '@/components/SetupPanel';
import FlowsPanel  from '@/components/FlowsPanel';

// ── Page meta ─────────────────────────────────────────────────────────────────
const PAGE_META: Record<Tab, { label: string; sub: string; icon: React.ReactNode }> = {
  bots:   { label: 'Bots',          sub: 'Gerencie seus bots do Telegram',        icon: <Bot size={16} /> },
  flows:  { label: 'Fluxos',        sub: 'Sequências automatizadas de mensagens', icon: <GitBranch size={16} /> },
  config: { label: 'Configurações', sub: 'Parâmetros globais do sistema',         icon: <SlidersHorizontal size={16} /> },
  logs:   { label: 'Logs',          sub: 'Histórico de atividade em tempo real',  icon: <Activity size={16} /> },
  setup:  { label: 'Como usar',     sub: 'Documentação e guia de início',         icon: <BookOpen size={16} /> },
};

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

// ── Page transitions ──────────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0  },
  exit:    { opacity: 0, y: -6 },
};

export default function Home() {
  const [tab, setTab]             = useState<Tab>('bots');
  const [bots, setBots]           = useState<BotType[]>([]);
  const [config, setConfig]       = useState<GlobalConfig>(DEFAULT_CONFIG);
  const [loadingBots, setLoading] = useState(true);

  const fetchBots = useCallback(async () => {
    const res = await fetch('/api/bots');
    if (res.ok) setBots(await res.json());
    setLoading(false);
  }, []);

  const fetchConfig = useCallback(async () => {
    const res = await fetch('/api/config');
    if (res.ok) setConfig(await res.json());
  }, []);

  useEffect(() => { fetchBots(); fetchConfig(); }, [fetchBots, fetchConfig]);

  const activeBots = bots.filter((b) => b.active).length;
  const meta = PAGE_META[tab];

  // Current UTC time for the HUD clock
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>

      {/* ── Ambient glow blobs ──────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', top: '-10%', right: '10%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,100,255,0.04) 0%, transparent 65%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '5%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(120,0,200,0.04) 0%, transparent 65%)',
        }} />
      </div>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <Sidebar
          tab={tab}
          setTab={setTab}
          activeBots={activeBots}
          totalBots={bots.length}
          onLogout={logout}
        />
      </div>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', zIndex: 1 }}>

        {/* Topbar */}
        <header style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          background: 'rgba(2,6,18,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,212,255,0.07)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          flexShrink: 0,
        }}>
          {/* Left: breadcrumb */}
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <span style={{ color: 'rgba(0,212,255,0.45)', display: 'flex' }}>{meta.icon}</span>
            <div>
              <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>
                {meta.label}
              </div>
              <div style={{ color: '#334155', fontSize: 11 }}>{meta.sub}</div>
            </div>
          </motion.div>

          {/* Right: status + clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* System status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {loadingBots ? (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1e293b', display: 'inline-block' }} />
              ) : activeBots > 0 ? (
                <span className="status-online" />
              ) : (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#374151', display: 'inline-block' }} />
              )}
              <span style={{ fontSize: 12, color: activeBots > 0 ? 'rgba(0,212,255,0.7)' : '#374151', fontWeight: 500 }}>
                {loadingBots ? 'Conectando…' : activeBots > 0 ? `${activeBots} ativo${activeBots !== 1 ? 's' : ''}` : 'Nenhum ativo'}
              </span>
            </div>

            {/* Clock */}
            {clock && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#1e3a5f', letterSpacing: '0.08em' }}>
                {clock}
              </div>
            )}

            {/* Separator */}
            <div style={{ width: 1, height: 20, background: 'rgba(0,212,255,0.08)' }} />

            {/* System label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4ff', boxShadow: '0 0 6px #00d4ff' }} />
              <span style={{ fontSize: 10, color: 'rgba(0,212,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                Sistema Online
              </span>
            </div>
          </div>
        </header>

        {/* Panel content */}
        <main style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0,  transition: { duration: 0.28 } }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
            >
              {tab === 'bots'   && <BotsPanel   bots={bots} onRefresh={fetchBots} />}
              {tab === 'flows'  && <FlowsPanel  bots={bots} />}
              {tab === 'config' && <ConfigPanel config={config} onSaved={setConfig} />}
              {tab === 'logs'   && <LogsPanel />}
              {tab === 'setup'  && <SetupPanel  bots={bots} />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer style={{
          padding: '10px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid rgba(0,212,255,0.05)',
        }}>
          <span style={{ fontSize: 10, color: '#0f2440', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
            TREACTIONS v2 · TELEGRAM AUTOMATION SYSTEM
          </span>
          <span style={{ fontSize: 10, color: '#0f2440', fontFamily: 'var(--font-mono)' }}>
            WEBHOOK · NO-CODE · SERVERLESS
          </span>
        </footer>
      </div>
    </div>
  );
}
