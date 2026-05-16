'use client';
import {
  Bot, GitBranch, SlidersHorizontal,
  Activity, BookOpen, Zap, LogOut, Circle, MessagesSquare, Users,
} from 'lucide-react';

// ── Tab type ──────────────────────────────────────────────────────────────────
export type Tab = 'bots' | 'chats' | 'members' | 'flows' | 'config' | 'logs' | 'setup';

interface NavItem { id: Tab; label: string; icon: React.ReactNode; }

// ── LISTA COMPLETA DE ABAS — alterar aqui reflete automaticamente na sidebar ──
const NAV: NavItem[] = [
  { id: 'bots',    label: 'Bots',           icon: <Bot               size={17} /> },
  { id: 'chats',   label: 'Chats',          icon: <MessagesSquare    size={17} /> },
  { id: 'members', label: 'Membros',        icon: <Users             size={17} /> },
  { id: 'flows',   label: 'Fluxos',         icon: <GitBranch         size={17} /> },
  { id: 'config',  label: 'Configurações',  icon: <SlidersHorizontal size={17} /> },
  { id: 'logs',    label: 'Logs',           icon: <Activity          size={17} /> },
  { id: 'setup',   label: 'Como usar',      icon: <BookOpen          size={17} /> },
];

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  activeBots: number;
  totalBots: number;
  onLogout: () => void;
}

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
        zIndex: 10,
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(0,212,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,212,255,0.2)',
            flexShrink: 0,
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
        </div>
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav style={{ padding: '14px 12px', flex: 1, overflowY: 'auto' }}>
        <div style={{ marginBottom: 8, paddingLeft: 8 }}>
          <span style={{
            fontSize: 9, color: '#1e3a5f',
            letterSpacing: '0.15em', fontWeight: 600, textTransform: 'uppercase',
          }}>
            Módulos
          </span>
        </div>

        {/* Render every NAV item — no animations that can hide items */}
        {NAV.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
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
                transition: 'all 0.18s',
                boxShadow: active ? '0 0 18px rgba(0,212,255,0.08)' : 'none',
                position: 'relative',
                flexShrink: 0,
                // Visibility always guaranteed
                opacity: 1,
                visibility: 'visible',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = '#475569';
                  e.currentTarget.style.background = 'transparent';
                }
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
              <span style={{ opacity: active ? 1 : 0.55, flexShrink: 0, display: 'flex' }}>
                {item.icon}
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 12px', borderTop: '1px solid rgba(0,212,255,0.07)', flexShrink: 0 }}>
        {/* Status */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderRadius: 9,
          background: 'rgba(0,212,255,0.04)',
          border: '1px solid rgba(0,212,255,0.08)',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {activeBots > 0 ? (
              <span className="status-online" />
            ) : (
              <Circle size={7} color="#1e293b" fill="#1e293b" />
            )}
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
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.background = 'rgba(239,68,68,0.06)';
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#334155';
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          <LogOut size={14} />
          <span>Sair do sistema</span>
        </button>
      </div>
    </aside>
  );
}
