'use client';
import { motion, type Variants } from 'framer-motion';
import {
  Bot, GitBranch, SlidersHorizontal,
  Activity, BookOpen, Zap, LogOut, Circle,
} from 'lucide-react';

export type Tab = 'bots' | 'flows' | 'config' | 'logs' | 'setup';

interface NavItem { id: Tab; label: string; icon: React.ReactNode; }

const NAV: NavItem[] = [
  { id: 'bots',   label: 'Bots',          icon: <Bot size={17} /> },
  { id: 'flows',  label: 'Fluxos',        icon: <GitBranch size={17} /> },
  { id: 'config', label: 'Configurações', icon: <SlidersHorizontal size={17} /> },
  { id: 'logs',   label: 'Logs',          icon: <Activity size={17} /> },
  { id: 'setup',  label: 'Como usar',     icon: <BookOpen size={17} /> },
];

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  activeBots: number;
  totalBots: number;
  onLogout: () => void;
}

const staggerContainer: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const staggerItem: Variants = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0   },
};

export default function Sidebar({ tab, setTab, activeBots, totalBots, onLogout }: Props) {
  return (
    <aside
      style={{
        width: 224,
        minWidth: 224,
        background: 'rgba(2,6,18,0.97)',
        borderRight: '1px solid rgba(0,212,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '28px 20px 24px', borderBottom: '1px solid rgba(0,212,255,0.07)' }}>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,212,255,0.2)',
          }}>
            <Zap size={16} color="#00d4ff" />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '0.02em' }}>
              TReactions
            </div>
            <div style={{ color: 'rgba(0,212,255,0.45)', fontSize: 10, letterSpacing: '0.12em', marginTop: 1 }}>
              AI AUTOMATION
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <motion.nav
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        style={{ padding: '16px 12px', flex: 1 }}
      >
        <div style={{ marginBottom: 8, paddingLeft: 8 }}>
          <span style={{ fontSize: 9, color: '#1e3a5f', letterSpacing: '0.15em', fontWeight: 600, textTransform: 'uppercase' }}>
            Módulos
          </span>
        </div>

        {NAV.map((item) => {
          const active = tab === item.id;
          return (
            <motion.button
              key={item.id}
              variants={staggerItem}
              onClick={() => setTab(item.id)}
              whileHover={{ x: 2 }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                marginBottom: 3,
                borderRadius: 9,
                border: active ? '1px solid rgba(0,212,255,0.22)' : '1px solid transparent',
                background: active ? 'rgba(0,212,255,0.08)' : 'transparent',
                color: active ? '#00d4ff' : '#475569',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                letterSpacing: active ? '0.01em' : '0',
                transition: 'all 0.18s',
                boxShadow: active ? '0 0 18px rgba(0,212,255,0.08), inset 0 0 18px rgba(0,212,255,0.03)' : 'none',
                position: 'relative',
              }}
            >
              {/* left accent bar */}
              {active && (
                <span style={{
                  position: 'absolute', left: 0, top: '20%', bottom: '20%',
                  width: 2, borderRadius: 2,
                  background: 'linear-gradient(180deg, transparent, #00d4ff, transparent)',
                  boxShadow: '0 0 8px #00d4ff',
                }} />
              )}
              <span style={{ opacity: active ? 1 : 0.6, flexShrink: 0 }}>{item.icon}</span>
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </motion.nav>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(0,212,255,0.07)' }}>
        {/* Status */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderRadius: 9,
          background: 'rgba(0,212,255,0.04)',
          border: '1px solid rgba(0,212,255,0.08)',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {activeBots > 0
              ? <span className="status-online" />
              : <Circle size={7} color="#1e293b" fill="#1e293b" />
            }
            <span style={{ fontSize: 11, color: activeBots > 0 ? '#00d4ff' : '#334155', fontWeight: 500 }}>
              {activeBots > 0 ? `${activeBots} online` : 'Offline'}
            </span>
          </div>
          <span style={{ fontSize: 10, color: '#1e3a5f', fontFamily: 'var(--font-mono)' }}>
            {totalBots} bot{totalBots !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 9,
            border: '1px solid transparent',
            background: 'transparent',
            color: '#334155', cursor: 'pointer', fontSize: 12,
            transition: 'all 0.18s',
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget;
            b.style.color = '#ef4444';
            b.style.background = 'rgba(239,68,68,0.06)';
            b.style.borderColor = 'rgba(239,68,68,0.2)';
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget;
            b.style.color = '#334155';
            b.style.background = 'transparent';
            b.style.borderColor = 'transparent';
          }}
        >
          <LogOut size={14} />
          <span>Sair do sistema</span>
        </button>
      </div>
    </aside>
  );
}
