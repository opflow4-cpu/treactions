'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, Copy, Check, Hash, Users, ShieldCheck,
  UserCheck, AlertTriangle, Circle, Search, ChevronDown,
} from 'lucide-react';
import type { Bot, BotChat, BotRole, ChatKind } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_META: Record<BotRole, { label: string; color: string; icon: React.ReactNode }> = {
  creator:       { label: 'Criador',      color: '#a78bfa', icon: <ShieldCheck size={12} /> },
  administrator: { label: 'Admin',        color: '#00d4ff', icon: <ShieldCheck size={12} /> },
  member:        { label: 'Membro',       color: '#10b981', icon: <UserCheck   size={12} /> },
  restricted:    { label: 'Restrito',     color: '#f59e0b', icon: <AlertTriangle size={12} /> },
  left:          { label: 'Saiu',         color: '#6b7280', icon: <Circle      size={12} /> },
  kicked:        { label: 'Removido',     color: '#ef4444', icon: <AlertTriangle size={12} /> },
  unknown:       { label: 'Desconhecido', color: '#475569', icon: <Circle      size={12} /> },
};

const KIND_META: Record<ChatKind, { label: string; icon: React.ReactNode }> = {
  group:      { label: 'Grupo',       icon: <Users  size={12} /> },
  supergroup: { label: 'Supergrupo',  icon: <Users  size={12} /> },
  channel:    { label: 'Canal',       icon: <Hash   size={12} /> },
  private:    { label: 'Privado',     icon: <UserCheck size={12} /> },
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return `${s}s atrás`;
  if (s < 3600) return `${Math.floor(s / 60)}min atrás`;
  if (s < 86400)return `${Math.floor(s / 3600)}h atrás`;
  return `${Math.floor(s / 86400)}d atrás`;
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      title="Copiar chat ID"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 7px', borderRadius: 6, cursor: 'pointer',
        fontSize: 11, fontFamily: 'var(--font-mono)',
        background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(0,212,255,0.07)',
        border: copied ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(0,212,255,0.15)',
        color: copied ? '#10b981' : 'rgba(0,212,255,0.7)',
        transition: 'all 0.2s',
      }}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {text}
    </button>
  );
}

// ── Chat row ──────────────────────────────────────────────────────────────────
function ChatRow({ chat, index }: { chat: BotChat; index: number }) {
  const role = ROLE_META[chat.botRole] ?? ROLE_META.unknown;
  const kind = KIND_META[chat.type]    ?? KIND_META.group;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay: index * 0.03 }}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto auto',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderBottom: '1px solid rgba(0,212,255,0.04)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,212,255,0.03)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Name + type + username */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {chat.title}
          </span>
          {chat.error ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 10, color: '#ef4444',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 4, padding: '1px 6px',
            }}>
              <AlertTriangle size={9} /> {chat.error}
            </span>
          ) : (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 10, color: '#475569',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4, padding: '1px 6px',
            }}>
              {kind.icon} {kind.label}
            </span>
          )}
        </div>
        {chat.username && (
          <div style={{ fontSize: 11, color: '#1e3a5f', marginTop: 1 }}>@{chat.username}</div>
        )}
      </div>

      {/* Chat ID (copyable) */}
      <CopyBtn text={String(chat.chatId)} />

      {/* Member count */}
      {chat.memberCount != null ? (
        <span style={{ fontSize: 11, color: '#334155', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
          {chat.memberCount.toLocaleString('pt-BR')} membros
        </span>
      ) : <span />}

      {/* Role badge */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
        color: role.color,
        background: `${role.color}18`,
        border: `1px solid ${role.color}30`,
        whiteSpace: 'nowrap',
      }}>
        {role.icon} {role.label}
      </span>

      {/* Last seen */}
      <span style={{ fontSize: 10, color: '#1e3a5f', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
        {timeAgo(chat.lastSeen)}
      </span>
    </motion.div>
  );
}

// ── Bot section ───────────────────────────────────────────────────────────────
function BotSection({ bot, chats, search }: { bot: Bot; chats: BotChat[]; search: string }) {
  const filtered = chats.filter((c) =>
    !search ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    String(c.chatId).includes(search) ||
    (c.username ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const adminCount = filtered.filter((c) => c.botRole === 'creator' || c.botRole === 'administrator').length;
  const errorCount = filtered.filter((c) => !!c.error).length;

  if (filtered.length === 0 && search) return null;

  return (
    <div className="glass-card" style={{ marginBottom: 16, overflow: 'hidden' }}>
      {/* Bot header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(0,212,255,0.07)',
        background: 'rgba(0,212,255,0.03)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 13 }}>{bot.defaultEmoji}</span>
          </div>
          <div>
            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{bot.name}</span>
            {bot.username && (
              <span style={{ color: '#1e3a5f', fontSize: 11, marginLeft: 6 }}>@{bot.username}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Pill label={`${filtered.length} chat${filtered.length !== 1 ? 's' : ''}`} color="#475569" />
          {adminCount > 0 && <Pill label={`${adminCount} admin`}  color="#00d4ff" />}
          {errorCount > 0 && <Pill label={`${errorCount} erro${errorCount !== 1 ? 's' : ''}`} color="#ef4444" />}
        </div>
      </div>

      {/* Table header */}
      {filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto auto',
          gap: 12, padding: '6px 16px',
          borderBottom: '1px solid rgba(0,212,255,0.05)',
        }}>
          {['Chat', 'ID', 'Membros', 'Papel', 'Visto'].map((h) => (
            <span key={h} style={{ fontSize: 9, color: '#1e3a5f', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
              {h}
            </span>
          ))}
        </div>
      )}

      {/* Rows */}
      {filtered.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#1e3a5f', fontSize: 13 }}>
          Nenhum chat registrado para este bot ainda.
          <div style={{ fontSize: 11, marginTop: 4, color: '#0f2440' }}>
            Os chats aparecem automaticamente quando mensagens chegam via webhook.
          </div>
        </div>
      ) : (
        filtered.map((chat, i) => <ChatRow key={String(chat.chatId)} chat={chat} index={i} />)
      )}
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
      color, background: `${color}15`, border: `1px solid ${color}28`,
    }}>
      {label}
    </span>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface ApiResponse {
  ok: boolean;
  data: Record<string, BotChat[]>;
  bots: Bot[];
  errors?: string[];
}

export default function ChatsPanel({ bots }: { bots: Bot[] }) {
  const [data, setData]         = useState<Record<string, BotChat[]>>({});
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterBot, setFilter]  = useState<string>('all');
  const [search, setSearch]     = useState('');
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [refreshErrors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/chats');
    if (res.ok) {
      const json: ApiResponse = await res.json();
      setData(json.data ?? {});
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setErrors([]);
    try {
      const res = await fetch('/api/chats', { method: 'POST' });
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json.data ?? {});
        setErrors(json.errors ?? []);
        setLastRefresh(Date.now());
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Stats
  const allChats  = Object.values(data).flat();
  const totalChats  = allChats.length;
  const adminChats  = allChats.filter((c) => c.botRole === 'creator' || c.botRole === 'administrator').length;
  const errorChats  = allChats.filter((c) => !!c.error).length;

  const visibleBots = filterBot === 'all' ? bots : bots.filter((b) => b.id === filterBot);

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, margin: 0 }}>Chats dos Bots</h2>
            <p style={{ color: '#334155', fontSize: 13, margin: '4px 0 0' }}>
              Grupos e canais detectados via webhook · atualização manual de status
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lastRefresh && (
              <span style={{ fontSize: 10, color: '#1e3a5f', fontFamily: 'var(--font-mono)' }}>
                atualizado {timeAgo(lastRefresh)}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-cyan"
              style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: refreshing ? 0.6 : 1 }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Atualizando…' : 'Atualizar chats'}
            </button>
          </div>
        </div>

        {/* Stats */}
        {!loading && totalChats > 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Total de chats', value: totalChats, color: '#00d4ff' },
              { label: 'Como admin',     value: adminChats, color: '#a78bfa' },
              { label: 'Com erro',       value: errorChats, color: errorChats > 0 ? '#ef4444' : '#1e3a5f' },
            ].map((s) => (
              <div key={s.label} className="glass-card" style={{ padding: '12px 20px', textAlign: 'center', minWidth: 100 }}>
                <div style={{ color: s.color, fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                <div style={{ color: '#334155', fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Bot filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[{ id: 'all', label: 'Todos os bots' }, ...bots.map((b) => ({ id: b.id, label: b.name }))].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: filterBot === opt.id ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
                background: filterBot === opt.id ? 'rgba(0,212,255,0.1)' : 'transparent',
                color: filterBot === opt.id ? '#00d4ff' : '#475569',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {opt.id !== 'all' && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: filterBot === opt.id ? '#00d4ff' : '#334155', display: 'inline-block' }} />
              )}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <Search size={13} color="#334155" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar chat…"
            className="input-hud"
            style={{ paddingLeft: 30, width: 180, fontSize: 12 }}
          />
        </div>
      </div>

      {/* ── Refresh errors ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {refreshErrors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginBottom: 16,
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 12, padding: '10px 14px', fontSize: 11, color: '#f87171',
            }}
          >
            <strong>Erros durante atualização:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
              {refreshErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#1e3a5f' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <div style={{ fontSize: 13 }}>Carregando chats…</div>
        </div>
      ) : totalChats === 0 ? (
        <div className="glass-card" style={{
          padding: '48px 24px', textAlign: 'center',
          border: '1px dashed rgba(0,212,255,0.1)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📡</div>
          <p style={{ color: '#e2e8f0', fontWeight: 600, margin: 0 }}>Nenhum chat registrado ainda</p>
          <p style={{ color: '#334155', fontSize: 13, marginTop: 8 }}>
            Os grupos e canais aparecem automaticamente quando os bots recebem mensagens via webhook.
          </p>
          <p style={{ color: '#1e3a5f', fontSize: 11, marginTop: 4 }}>
            Depois que chegarem chats, clique em "Atualizar chats" para verificar status e permissões.
          </p>
        </div>
      ) : (
        visibleBots.map((bot) => (
          <BotSection
            key={bot.id}
            bot={bot}
            chats={data[bot.id] ?? []}
            search={search}
          />
        ))
      )}

      {/* Inline spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
