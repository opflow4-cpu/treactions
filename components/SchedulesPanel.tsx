'use client';
import { useState, useEffect, useCallback } from 'react';
import { Bot, ScheduledMessage, ScheduleLog, ScheduleLogEvent } from '@/lib/types';
import MediaUploadField, { MediaKind } from './MediaUploadField';

interface Props { bots: Bot[] }

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Noronha',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Campo_Grande',
  'America/Cuiaba',
  'UTC',
];

const MEDIA_TYPES: { value: MediaKind; label: string; icon: string }[] = [
  { value: 'image', label: 'Imagem', icon: '🖼️' },
  { value: 'video', label: 'Vídeo',  icon: '🎬' },
  { value: 'audio', label: 'Áudio',  icon: '🎵' },
  { value: 'file',  label: 'Arquivo', icon: '📎' },
];

const LOG_META: Record<ScheduleLogEvent, { icon: string; label: string; color: string }> = {
  sent:    { icon: '✅', label: 'Enviado',  color: '#10b981' },
  error:   { icon: '❌', label: 'Erro',     color: '#ef4444' },
  skipped: { icon: '⏭️', label: 'Ignorado', color: '#6b7280' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDays(days: number[]): string {
  if (days.length === 7) return 'Todos os dias';
  if (days.length === 0) return 'Nenhum dia';
  const weekdays = [1, 2, 3, 4, 5];
  if (weekdays.every((d) => days.includes(d)) && days.length === 5 && !days.includes(0) && !days.includes(6))
    return 'Dias úteis';
  return days.sort((a, b) => a - b).map((d) => DAYS_PT[d]).join(', ');
}

function emptyForm(): Partial<ScheduledMessage> {
  return {
    name: '',
    botId: '',
    chatId: '',
    message: '',
    mediaUrl: undefined,
    mediaType: undefined,
    caption: '',
    time: '12:00',
    days: [1, 2, 3, 4, 5],
    timezone: 'America/Sao_Paulo',
    active: true,
  };
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, size = 'md' }: { value: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 36 : 44;
  const h = size === 'sm' ? 20 : 24;
  const d = size === 'sm' ? 14 : 18;
  const off = size === 'sm' ? 2 : 3;
  const on  = size === 'sm' ? 20 : 23;
  return (
    <button type="button" onClick={() => onChange(!value)}
      className="relative inline-flex items-center rounded-full transition-colors shrink-0"
      style={{ width: w, height: h, background: value ? '#10b981' : '#374151' }}>
      <span className="inline-block rounded-full bg-white shadow transition-transform"
        style={{ width: d, height: d, transform: `translateX(${value ? on : off}px)` }} />
    </button>
  );
}

// ── Schedule card ─────────────────────────────────────────────────────────────

function ScheduleCard({
  schedule, bots, onEdit, onToggle, onDuplicate, onDelete, onTest,
}: {
  schedule: ScheduledMessage;
  bots: Bot[];
  onEdit: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTest: () => Promise<void>;
}) {
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');

  const bot = bots.find((b) => b.id === schedule.botId);
  const mediaIcon = schedule.mediaType
    ? MEDIA_TYPES.find((m) => m.value === schedule.mediaType)?.icon
    : null;

  const handleTest = async () => {
    setTesting(true);
    setTestMsg('');
    try {
      await onTest();
      setTestMsg('✓ Enviado!');
    } catch (e) {
      setTestMsg(`✗ ${e instanceof Error ? e.message : 'Erro'}`);
    } finally {
      setTesting(false);
      setTimeout(() => setTestMsg(''), 3000);
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'rgba(9,11,20,0.9)',
        border: `1px solid ${schedule.active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: schedule.active ? '0 0 20px rgba(99,102,241,0.07)' : 'none',
      }}>
      {/* Card header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-white truncate">{schedule.name}</h3>
            {mediaIcon && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
                {mediaIcon} {schedule.mediaType}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {bot && (
              <span className="text-xs text-gray-500">{bot.defaultEmoji} {bot.name}</span>
            )}
            <span className="text-gray-700 text-xs">·</span>
            <span className="text-xs text-gray-600 font-mono">{schedule.chatId}</span>
          </div>
        </div>
        <Toggle value={schedule.active} onChange={onToggle} size="sm" />
      </div>

      {/* Schedule info */}
      <div className="px-4 py-3 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-600 text-xs">🕐</span>
          <span className="text-sm font-bold text-white tabular-nums">{schedule.time}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-600 text-xs">📅</span>
          <span className="text-xs text-gray-400">{formatDays(schedule.days)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-600 text-xs">🌎</span>
          <span className="text-xs text-gray-600">{schedule.timezone}</span>
        </div>
      </div>

      {/* Message preview */}
      {schedule.message && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed"
            style={{ borderLeft: '2px solid rgba(255,255,255,0.08)', paddingLeft: 8 }}>
            {schedule.message}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 pb-3 flex-wrap">
        <button onClick={onEdit}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-white/5">
          ✏️ Editar
        </button>
        <button onClick={handleTest} disabled={testing}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20"
          style={{ opacity: testing ? 0.6 : 1 }}>
          {testing ? '⏳' : '▶'} Testar
        </button>
        <button onClick={onDuplicate}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-white/5">
          📋 Duplicar
        </button>
        <button onClick={onDelete}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors text-red-500 hover:text-red-400 hover:bg-red-900/10 ml-auto">
          🗑 Excluir
        </button>
        {testMsg && (
          <span className={`text-xs ml-2 ${testMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
            {testMsg}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Form (create / edit) ──────────────────────────────────────────────────────

function ScheduleForm({
  initial, bots, onSave, onCancel,
}: {
  initial: Partial<ScheduledMessage>;
  bots: Bot[];
  onSave: (s: ScheduledMessage) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<ScheduledMessage>>(initial);
  const [mediaEnabled, setMediaEnabled] = useState(!!initial.mediaType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const f = (patch: Partial<ScheduledMessage>) => setForm((s) => ({ ...s, ...patch }));

  const toggleDay = (d: number) => {
    const days = form.days ?? [];
    f({ days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });
  };

  const handleSave = async () => {
    if (!form.name?.trim())  { setError('Preencha o nome.'); return; }
    if (!form.botId?.trim()) { setError('Selecione o bot.'); return; }
    if (!form.chatId?.trim()) { setError('Informe o Chat ID.'); return; }
    if (!form.message?.trim() && !(mediaEnabled && form.mediaUrl?.trim()))
      { setError('Adicione uma mensagem ou selecione uma mídia.'); return; }
    if (!form.time?.match(/^\d{2}:\d{2}$/)) { setError('Horário inválido.'); return; }
    if (!form.days?.length) { setError('Selecione ao menos um dia.'); return; }

    setSaving(true);
    setError('');

    const payload: Partial<ScheduledMessage> = {
      ...form,
      mediaUrl:  mediaEnabled ? (form.mediaUrl || undefined) : undefined,
      mediaType: mediaEnabled ? form.mediaType : undefined,
      caption:   mediaEnabled ? (form.caption || undefined) : undefined,
    };

    try {
      const url    = form.id ? `/api/schedules/${form.id}` : '/api/schedules';
      const method = form.id ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const saved: ScheduledMessage = await res.json();
      onSave(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full bg-[#0d1117] border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 placeholder-gray-600';
  const lbl = 'block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5';

  return (
    <div>
      {/* Back button */}
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors mb-5">
        ← Voltar para lista
      </button>

      <h2 className="text-lg font-bold text-white mb-6">
        {form.id ? 'Editar agendamento' : 'Novo agendamento'}
      </h2>

      <div className="space-y-5 max-w-2xl">
        {/* Name */}
        <div>
          <label className={lbl}>Nome *</label>
          <input type="text" value={form.name ?? ''} onChange={(e) => f({ name: e.target.value })}
            placeholder="Ex: Foto diária do produto" className={inp} />
        </div>

        {/* Bot + Chat */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Bot *</label>
            <select value={form.botId ?? ''} onChange={(e) => f({ botId: e.target.value })}
              className={inp} style={{ cursor: 'pointer' }}>
              <option value="">— Selecionar —</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>{b.defaultEmoji} {b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Chat ID / Grupo *</label>
            <input type="text" value={form.chatId ?? ''} onChange={(e) => f({ chatId: e.target.value })}
              placeholder="-1001234567890" className={inp} />
            <p className="text-[10px] text-gray-600 mt-1">ID numérico do grupo ou @username</p>
          </div>
        </div>

        {/* Message */}
        <div>
          <label className={lbl}>Mensagem / Copy</label>
          <textarea rows={3} value={form.message ?? ''} onChange={(e) => f({ message: e.target.value })}
            placeholder="Digite o texto que será enviado…" className={inp + ' resize-none'} />
        </div>

        {/* Media toggle */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className={lbl} style={{ marginBottom: 0 }}>Mídia opcional</label>
            <Toggle value={mediaEnabled} onChange={setMediaEnabled} size="sm" />
          </div>
          {mediaEnabled && (
            <div className="space-y-3 rounded-xl p-4"
              style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
              {/* Media type selector */}
              <div className="flex gap-2 flex-wrap">
                {MEDIA_TYPES.map((mt) => (
                  <button key={mt.value} type="button"
                    onClick={() => f({ mediaType: mt.value })}
                    className="px-3 py-1.5 text-xs rounded-full border transition-colors"
                    style={form.mediaType === mt.value
                      ? { background: 'rgba(139,92,246,0.2)', borderColor: 'rgba(139,92,246,0.6)', color: '#c4b5fd' }
                      : { borderColor: 'rgba(75,85,99,0.5)', color: '#6b7280' }}>
                    {mt.icon} {mt.label}
                  </button>
                ))}
              </div>
              {form.mediaType && (
                <MediaUploadField
                  kind={form.mediaType}
                  url={form.mediaUrl ?? ''}
                  caption={form.caption}
                  onUrlChange={(url) => f({ mediaUrl: url })}
                  onCaptionChange={(cap) => f({ caption: cap })}
                />
              )}
              {!form.mediaType && (
                <p className="text-xs text-gray-600">Selecione o tipo de mídia acima.</p>
              )}
            </div>
          )}
        </div>

        {/* Time + Timezone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Horário *</label>
            <input type="time" value={form.time ?? '12:00'} onChange={(e) => f({ time: e.target.value })}
              className={inp} />
          </div>
          <div>
            <label className={lbl}>Fuso horário</label>
            <select value={form.timezone ?? 'America/Sao_Paulo'} onChange={(e) => f({ timezone: e.target.value })}
              className={inp} style={{ cursor: 'pointer' }}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Days of week */}
        <div>
          <label className={lbl}>Dias da semana *</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS_PT.map((label, idx) => {
              const active = (form.days ?? []).includes(idx);
              return (
                <button key={idx} type="button" onClick={() => toggleDay(idx)}
                  className="px-3 py-1.5 text-xs rounded-full border transition-colors font-medium"
                  style={active
                    ? { background: 'rgba(99,102,241,0.18)', borderColor: 'rgba(99,102,241,0.6)', color: '#a5b4fc' }
                    : { borderColor: 'rgba(75,85,99,0.4)', color: '#6b7280' }}>
                  {label}
                </button>
              );
            })}
          </div>
          {/* Quick presets */}
          <div className="flex gap-2 mt-2">
            {[
              { label: 'Todos', days: [0,1,2,3,4,5,6] },
              { label: 'Úteis', days: [1,2,3,4,5] },
              { label: 'Fim de semana', days: [0,6] },
            ].map((p) => (
              <button key={p.label} type="button" onClick={() => f({ days: p.days })}
                className="text-xs text-gray-600 hover:text-gray-300 transition-colors px-2 py-0.5 rounded border border-gray-800 hover:border-gray-600">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p className="text-sm font-semibold text-white">Ativo</p>
            <p className="text-xs text-gray-500 mt-0.5">O agendamento só dispara quando ativo</p>
          </div>
          <Toggle value={form.active ?? true} onChange={(v) => f({ active: v })} />
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all"
            style={{
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.4)',
              color: '#a5b4fc',
              opacity: saving ? 0.6 : 1,
            }}>
            {saving ? 'Salvando…' : form.id ? 'Salvar alterações' : 'Criar agendamento'}
          </button>
          <button onClick={onCancel}
            className="px-5 py-2.5 text-sm text-gray-500 rounded-xl transition-colors hover:text-white hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: ScheduleLog }) {
  const meta = LOG_META[log.event];
  const d    = new Date(log.timestamp);
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const day  = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      <span className="text-sm shrink-0 mt-0.5">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
          <span className="text-xs text-gray-500 truncate">{log.scheduleName}</span>
          <span className="text-xs text-gray-700 font-mono">{log.chatId}</span>
        </div>
        {log.error && <p className="text-xs text-red-400 mt-0.5 truncate">{log.error}</p>}
      </div>
      <span className="text-[10px] text-gray-700 shrink-0 tabular-nums">{day} {time}</span>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function SchedulesPanel({ bots }: Props) {
  const [schedules, setSchedules] = useState<ScheduledMessage[]>([]);
  const [logs, setLogs]           = useState<ScheduleLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState<'list' | 'form'>('list');
  const [editTarget, setEditTarget] = useState<Partial<ScheduledMessage>>(emptyForm());
  const [running, setRunning]     = useState(false);
  const [runResult, setRunResult] = useState<string>('');

  const fetchSchedules = useCallback(async () => {
    const res = await fetch('/api/schedules');
    if (res.ok) setSchedules(await res.json());
    setLoading(false);
  }, []);

  const fetchLogs = useCallback(async () => {
    const res = await fetch('/api/schedules/logs');
    if (res.ok) setLogs(await res.json());
  }, []);

  useEffect(() => {
    fetchSchedules();
    fetchLogs();
  }, [fetchSchedules, fetchLogs]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openCreate = () => { setEditTarget(emptyForm()); setView('form'); };
  const openEdit   = (s: ScheduledMessage) => { setEditTarget({ ...s }); setView('form'); };
  const closeForm  = () => setView('list');

  const handleSaved = (saved: ScheduledMessage) => {
    setSchedules((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      return idx >= 0 ? prev.map((s) => s.id === saved.id ? saved : s) : [...prev, saved];
    });
    setView('list');
  };

  const handleToggle = async (schedule: ScheduledMessage) => {
    const updated = { ...schedule, active: !schedule.active };
    const res = await fetch(`/api/schedules/${schedule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: updated.active }),
    });
    if (res.ok) {
      setSchedules((prev) => prev.map((s) => s.id === schedule.id ? updated : s));
    }
  };

  const handleDuplicate = async (schedule: ScheduledMessage) => {
    const copy = {
      ...schedule,
      id: undefined,
      name: `${schedule.name} (cópia)`,
      active: false,
      lastFiredAt: undefined,
    };
    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(copy),
    });
    if (res.ok) {
      const created = await res.json();
      setSchedules((prev) => [...prev, created]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este agendamento?')) return;
    const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    if (res.ok) setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const handleTest = async (schedule: ScheduledMessage) => {
    const res = await fetch(`/api/schedules/${schedule.id}/test`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    await fetchLogs();
  };

  const handleRunCron = async () => {
    setRunning(true);
    setRunResult('');
    try {
      const res  = await fetch('/api/cron/schedules', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const sent    = (data.results ?? []).filter((r: { status: string }) => r.status === 'sent').length;
      const skipped = (data.results ?? []).filter((r: { status: string }) => r.status === 'skipped').length;
      const errors  = (data.results ?? []).filter((r: { status: string }) => r.status === 'error').length;
      setRunResult(`✓ ${sent} enviado(s), ${skipped} ignorado(s)${errors ? `, ${errors} erro(s)` : ''}`);
      await fetchLogs();
    } catch (e) {
      setRunResult(`✗ ${e instanceof Error ? e.message : 'Erro'}`);
    } finally {
      setRunning(false);
      setTimeout(() => setRunResult(''), 5000);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const activeCount  = schedules.filter((s) => s.active).length;
  const sentToday    = logs.filter((l) => {
    const d = new Date(l.timestamp);
    const today = new Date();
    return l.event === 'sent' &&
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  }).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (view === 'form') {
    return (
      <ScheduleForm
        initial={editTarget}
        bots={bots}
        onSave={handleSaved}
        onCancel={closeForm}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Agendamentos</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Envie mensagens automáticas em grupos nos horários definidos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Manual cron trigger — useful on Vercel Hobby or for immediate testing */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunCron}
              disabled={running}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all"
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#34d399',
                opacity: running ? 0.6 : 1,
                cursor: running ? 'not-allowed' : 'pointer',
              }}
              title="Verifica e dispara agendamentos cujo horário bater agora">
              {running ? '⏳' : '▶'} Executar agora
            </button>
            {runResult && (
              <span className={`text-xs ${runResult.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                {runResult}
              </span>
            )}
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc' }}>
            + Novo agendamento
          </button>
        </div>
      </div>

      {/* Stats */}
      {schedules.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total',    value: schedules.length, color: '#6366f1' },
            { label: 'Ativos',   value: activeCount,      color: '#10b981' },
            { label: 'Hoje',     value: sentToday,        color: '#f59e0b' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl px-4 py-3 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule list */}
      {loading ? (
        <div className="text-center py-12 text-gray-600 text-sm">Carregando…</div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-16"
          style={{ background: 'rgba(9,11,20,0.6)', border: '1px dashed rgba(255,255,255,0.07)', borderRadius: 16 }}>
          <div className="text-5xl mb-3">📅</div>
          <p className="text-white font-semibold">Nenhum agendamento ainda</p>
          <p className="text-gray-600 text-sm mt-1">Clique em "Novo agendamento" para começar.</p>
          <button onClick={openCreate}
            className="mt-4 px-5 py-2 text-sm font-semibold rounded-xl transition-all"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc' }}>
            Criar primeiro agendamento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {schedules.map((s) => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              bots={bots}
              onEdit={() => openEdit(s)}
              onToggle={() => handleToggle(s)}
              onDuplicate={() => handleDuplicate(s)}
              onDelete={() => handleDelete(s.id)}
              onTest={() => handleTest(s)}
            />
          ))}
        </div>
      )}

      {/* Logs */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(9,11,20,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Logs de envio</span>
            {logs.length > 0 && (
              <span className="text-xs text-gray-600 bg-gray-800 rounded-full px-2 py-0.5">{logs.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchLogs} className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
              ↺ Atualizar
            </button>
            {logs.length > 0 && (
              <button onClick={async () => { await fetch('/api/schedules/logs', { method: 'DELETE' }); setLogs([]); }}
                className="text-xs text-red-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-900/10">
                Limpar
              </button>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-sm text-gray-600">Nenhum envio registrado ainda.</p>
            <p className="text-xs text-gray-700 mt-1">Use "Testar" em um agendamento para ver o primeiro log.</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {logs.map((l) => <LogRow key={l.id} log={l} />)}
          </div>
        )}
      </div>
    </div>
  );
}
