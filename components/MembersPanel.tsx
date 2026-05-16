'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, Search, Trash2, Download,
  UserPlus, UserMinus, Users, ChevronDown,
} from 'lucide-react';
import type { Bot, MemberEvent } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return `${s}s atrás`;
  if (s < 3600)  return `${Math.floor(s / 60)}min atrás`;
  if (s < 86400) return `${Math.floor(s / 3600)}h atrás`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Deterministic color from user id (HSL-based, always dark-theme-friendly) */
function avatarColor(userId: number): string {
  const hue = userId % 360;
  return `hsl(${hue},60%,45%)`;
}

function initials(first: string, last?: string): string {
  const a = first.trim()[0] ?? '?';
  const b = last?.trim()[0] ?? '';
  return (a + b).toUpperCase();
}

/** Day string YYYY-MM-DD in local timezone */
function dayOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function today(): string { return dayOf(Date.now()); }

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dayOf(d.getTime()));
  }
  return days;
}

function shortDay(dayStr: string): string {
  const d = new Date(dayStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(events: MemberEvent[]) {
  const header = 'data,hora,evento,nome,username,chat,chat_id,bot';
  const rows = events.map((e) => {
    const d  = new Date(e.timestamp);
    const dt = d.toLocaleDateString('pt-BR');
    const hr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const name = [e.firstName, e.lastName].filter(Boolean).join(' ');
    const un = e.username ? `@${e.username}` : '';
    return [dt, hr, e.event === 'joined' ? 'ENTROU' : 'SAIU', name, un, e.chatTitle, e.chatId, e.botName]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',');
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `membros_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ firstName, lastName, userId }: { firstName: string; lastName?: string; userId: number }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: avatarColor(userId),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.04em',
    }}>
      {initials(firstName, lastName)}
    </div>
  );
}

// ── 7-day mini-chart ──────────────────────────────────────────────────────────
function WeekChart({ events }: { events: MemberEvent[] }) {
  const days = last7Days();
  const joinsByDay = Object.fromEntries(days.map((d) => [d, 0]));
  const leftByDay  = Object.fromEntries(days.map((d) => [d, 0]));

  for (const e of events) {
    const d = dayOf(e.timestamp);
    if (d in joinsByDay) {
      if (e.event === 'joined') joinsByDay[d]++;
      else                     leftByDay[d]++;
    }
  }

  const maxVal = Math.max(1, ...Object.values(joinsByDay), ...Object.values(leftByDay));

  return (
    <div className="glass-card" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 11, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
        Atividade — últimos 7 dias
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
        {days.map((d) => {
          const j = joinsByDay[d];
          const l = leftByDay[d];
          const jH = Math.round((j / maxVal) * 52);
          const lH = Math.round((l / maxVal) * 52);
          const isToday = d === today();
          return (
            <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, height: 54, justifyContent: 'flex-end' }}>
                {j > 0 && (
                  <div title={`${j} entrou`} style={{
                    width: '100%', height: Math.max(3, jH),
                    background: isToday ? 'rgba(16,185,129,0.9)' : 'rgba(16,185,129,0.55)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.3s',
                  }} />
                )}
                {l > 0 && (
                  <div title={`${l} saiu`} style={{
                    width: '100%', height: Math.max(3, lH),
                    background: isToday ? 'rgba(239,68,68,0.9)' : 'rgba(239,68,68,0.55)',
                    borderRadius: j === 0 ? '3px 3px 0 0' : '0',
                    transition: 'height 0.3s',
                  }} />
                )}
                {j === 0 && l === 0 && (
                  <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} />
                )}
              </div>
              <div style={{
                fontSize: 9, color: isToday ? 'rgba(0,212,255,0.7)' : '#1e3a5f',
                fontWeight: isToday ? 700 : 400, textTransform: 'capitalize',
              }}>
                {shortDay(d)}
              </div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(16,185,129,0.7)' }} />
          <span style={{ fontSize: 10, color: '#475569' }}>Entrou</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(239,68,68,0.7)' }} />
          <span style={{ fontSize: 10, color: '#475569' }}>Saiu</span>
        </div>
      </div>
    </div>
  );
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ ev, index }: { ev: MemberEvent; index: number }) {
  const isJoined = ev.event === 'joined';
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.4) }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderBottom: '1px solid rgba(0,212,255,0.04)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,212,255,0.03)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Avatar */}
      <Avatar firstName={ev.firstName} lastName={ev.lastName} userId={ev.userId} />

      {/* Name + meta */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {[ev.firstName, ev.lastName].filter(Boolean).join(' ')}
          </span>
          {ev.username && (
            <span style={{ fontSize: 11, color: '#1e3a5f' }}>@{ev.username}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#334155' }}>{ev.chatTitle}</span>
          <span style={{ fontSize: 10, color: '#1e3a5f', fontFamily: 'var(--font-mono)' }}>
            via {ev.botName}
          </span>
        </div>
      </div>

      {/* Event badge */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6,
        whiteSpace: 'nowrap',
        color:       isJoined ? '#10b981' : '#ef4444',
        background:  isJoined ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        border:      isJoined ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(239,68,68,0.25)',
      }}>
        {isJoined ? <UserPlus size={11} /> : <UserMinus size={11} />}
        {isJoined ? 'ENTROU' : 'SAIU'}
      </span>

      {/* Timestamp */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#334155', fontFamily: 'var(--font-mono)' }}>
          {formatTime(ev.timestamp)}
        </div>
        <div style={{ fontSize: 10, color: '#1e3a5f', fontFamily: 'var(--font-mono)' }}>
          {timeAgo(ev.timestamp)}
        </div>
      </div>
    </motion.div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass-card" style={{ padding: '14px 20px', textAlign: 'center', minWidth: 110 }}>
      <div style={{ color, fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{value}</div>
      <div style={{ color: '#334155', fontSize: 10, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
    </div>
  );
}

// ── Group summary cards ───────────────────────────────────────────────────────
function GroupCard({ chatTitle, chatId, events, bots }: {
  chatTitle: string; chatId: number | string; events: MemberEvent[]; bots: Bot[];
}) {
  const joined  = events.filter((e) => e.event === 'joined').length;
  const left    = events.filter((e) => e.event === 'left').length;
  const active  = Math.max(0, joined - left);

  return (
    <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {chatTitle}
        </div>
        <div style={{ fontSize: 10, color: '#1e3a5f', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
          ID: {chatId}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '2px 8px', borderRadius: 6 }}>
          +{joined}
        </span>
        <span style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: 6 }}>
          -{left}
        </span>
        <span style={{ fontSize: 11, color: '#00d4ff', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.18)', padding: '2px 8px', borderRadius: 6 }}>
          {active} ativos
        </span>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function MembersPanel({ bots }: { bots: Bot[] }) {
  const [events, setEvents]       = useState<MemberEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [clearing, setClearing]   = useState(false);
  const [filterBot, setFilterBot] = useState('all');
  const [filterChat, setFilterChat] = useState('all');
  const [filterEvent, setFilterEvent] = useState<'all' | 'joined' | 'left'>('all');
  const [search, setSearch]       = useState('');
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/members');
      if (res.ok) {
        const json = await res.json();
        setEvents(json.events ?? []);
        setLastRefresh(Date.now());
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load + 30s auto-refresh
  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const handleClear = async () => {
    if (!confirm('Limpar todo o histórico de membros? Esta ação é irreversível.')) return;
    setClearing(true);
    try {
      await fetch('/api/members', { method: 'DELETE' });
      setEvents([]);
    } finally {
      setClearing(false);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const todayStr   = today();
  const todayJoins = events.filter((e) => e.event === 'joined' && dayOf(e.timestamp) === todayStr).length;
  const todayLeft  = events.filter((e) => e.event === 'left'   && dayOf(e.timestamp) === todayStr).length;
  const totalJoins = events.filter((e) => e.event === 'joined').length;
  const totalLeft  = events.filter((e) => e.event === 'left').length;

  // ── Unique chats in events ────────────────────────────────────────────────
  const chatMap = new Map<string, { chatTitle: string; chatId: number | string }>();
  for (const e of events) {
    const key = String(e.chatId);
    if (!chatMap.has(key)) chatMap.set(key, { chatTitle: e.chatTitle, chatId: e.chatId });
  }
  const uniqueChats = Array.from(chatMap.entries()).map(([id, v]) => ({ id, ...v }));

  // ── Filter + search ───────────────────────────────────────────────────────
  const filtered = events.filter((e) => {
    if (filterBot  !== 'all' && e.botId    !== filterBot)    return false;
    if (filterChat !== 'all' && String(e.chatId) !== filterChat) return false;
    if (filterEvent !== 'all' && e.event !== filterEvent)    return false;
    if (search) {
      const q = search.toLowerCase();
      const name = [e.firstName, e.lastName].filter(Boolean).join(' ').toLowerCase();
      if (!name.includes(q) && !(e.username ?? '').toLowerCase().includes(q) && !e.chatTitle.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── Group summary ─────────────────────────────────────────────────────────
  const groupedByChatForSummary = new Map<string, MemberEvent[]>();
  for (const e of events) {
    const k = String(e.chatId);
    if (!groupedByChatForSummary.has(k)) groupedByChatForSummary.set(k, []);
    groupedByChatForSummary.get(k)!.push(e);
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, margin: 0 }}>
              Membros
            </h2>
            <p style={{ color: '#334155', fontSize: 13, margin: '4px 0 0' }}>
              Entradas e saídas detectadas via webhook · atualização automática a cada 30s
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {lastRefresh && (
              <span style={{ fontSize: 10, color: '#1e3a5f', fontFamily: 'var(--font-mono)' }}>
                {timeAgo(lastRefresh)}
              </span>
            )}
            <button
              onClick={() => load()}
              disabled={loading}
              className="btn-cyan"
              style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.6 : 1 }}
            >
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Atualizar
            </button>
            {events.length > 0 && (
              <button
                onClick={() => exportCSV(filtered.length > 0 ? filtered : events)}
                className="btn-cyan"
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }}
              >
                <Download size={13} />
                Exportar CSV
              </button>
            )}
            {events.length > 0 && (
              <button
                onClick={handleClear}
                disabled={clearing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
                  border: '1px solid rgba(239,68,68,0.25)',
                  background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                  fontSize: 12, opacity: clearing ? 0.6 : 1, transition: 'all 0.15s',
                }}
              >
                <Trash2 size={13} />
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {!loading && events.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <StatCard label="Hoje entrou"  value={todayJoins} color="#10b981" />
            <StatCard label="Hoje saiu"    value={todayLeft}  color="#ef4444" />
            <StatCard label="Total entrou" value={totalJoins} color="#00d4ff" />
            <StatCard label="Total saiu"   value={totalLeft}  color="#f59e0b" />
            <StatCard label="Registros"    value={events.length} color="#a78bfa" />
          </div>
        )}
      </div>

      {/* ── 7-day chart ────────────────────────────────────────────────── */}
      {!loading && events.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <WeekChart events={events} />
        </div>
      )}

      {/* ── Group summary ──────────────────────────────────────────────── */}
      {!loading && uniqueChats.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
            Resumo por grupo
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
            {uniqueChats.map(({ id, chatTitle, chatId }) => (
              <GroupCard
                key={id}
                chatTitle={chatTitle}
                chatId={chatId}
                events={events.filter((e) => String(e.chatId) === id)}
                bots={bots}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────── */}
      {!loading && events.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {/* Bot filter */}
          {bots.length > 1 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[{ id: 'all', label: 'Todos os bots' }, ...bots.map((b) => ({ id: b.id, label: b.name }))].map((opt) => (
                <button key={opt.id} onClick={() => setFilterBot(opt.id)} style={{
                  padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  border: filterBot === opt.id ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  background: filterBot === opt.id ? 'rgba(0,212,255,0.1)' : 'transparent',
                  color: filterBot === opt.id ? '#00d4ff' : '#475569',
                  transition: 'all 0.15s',
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Event type filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {([['all', 'Todos'], ['joined', 'Entrou'], ['left', 'Saiu']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setFilterEvent(val)} style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: filterEvent === val
                  ? val === 'joined' ? '1px solid rgba(16,185,129,0.4)' : val === 'left' ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(0,212,255,0.4)'
                  : '1px solid rgba(255,255,255,0.06)',
                background: filterEvent === val
                  ? val === 'joined' ? 'rgba(16,185,129,0.1)' : val === 'left' ? 'rgba(239,68,68,0.1)' : 'rgba(0,212,255,0.1)'
                  : 'transparent',
                color: filterEvent === val
                  ? val === 'joined' ? '#10b981' : val === 'left' ? '#ef4444' : '#00d4ff'
                  : '#475569',
                transition: 'all 0.15s',
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Chat filter */}
          {uniqueChats.length > 1 && (
            <select
              value={filterChat}
              onChange={(e) => setFilterChat(e.target.value)}
              className="input-hud"
              style={{ fontSize: 12, padding: '5px 10px', minWidth: 160 }}
            >
              <option value="all">Todos os grupos</option>
              {uniqueChats.map(({ id, chatTitle }) => (
                <option key={id} value={id}>{chatTitle}</option>
              ))}
            </select>
          )}

          {/* Search */}
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <Search size={13} color="#334155" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar membro…"
              className="input-hud"
              style={{ paddingLeft: 30, width: 180, fontSize: 12 }}
            />
          </div>
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#1e3a5f' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <div style={{ fontSize: 13 }}>Carregando eventos…</div>
        </div>
      ) : events.length === 0 ? (
        <div className="glass-card" style={{
          padding: '48px 24px', textAlign: 'center',
          border: '1px dashed rgba(0,212,255,0.1)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>👥</div>
          <p style={{ color: '#e2e8f0', fontWeight: 600, margin: 0 }}>Nenhum evento registrado ainda</p>
          <p style={{ color: '#334155', fontSize: 13, marginTop: 8 }}>
            Quando um membro entrar ou sair de um grupo onde seu bot está presente,
            o evento será registrado automaticamente via webhook.
          </p>
          <p style={{ color: '#1e3a5f', fontSize: 11, marginTop: 4 }}>
            Certifique-se de que os bots estão ativos e os webhooks configurados em "Como usar".
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ color: '#475569', fontSize: 13 }}>Nenhum resultado para os filtros aplicados.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto auto',
            gap: 12, padding: '6px 16px',
            borderBottom: '1px solid rgba(0,212,255,0.05)',
          }}>
            {['', 'Membro', 'Evento', 'Horário'].map((h, i) => (
              <span key={i} style={{ fontSize: 9, color: '#1e3a5f', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                {h}
              </span>
            ))}
          </div>
          {/* Rows */}
          <AnimatePresence initial={false}>
            {filtered.map((ev, i) => (
              <EventCard key={ev.id} ev={ev} index={i} />
            ))}
          </AnimatePresence>
          {/* Footer count */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(0,212,255,0.05)', textAlign: 'right' }}>
            <span style={{ fontSize: 10, color: '#1e3a5f', fontFamily: 'var(--font-mono)' }}>
              {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== events.length && ` de ${events.length} total`}
            </span>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
