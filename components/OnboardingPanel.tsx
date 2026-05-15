'use client';
import { useState, useEffect, useCallback } from 'react';
import { Bot, OnboardingConfig, DEFAULT_ONBOARDING, OnboardingLog, OnboardingEvent } from '@/lib/types';
import { Flow } from '@/lib/flow-types';

interface Props {
  bots: Bot[];
  onBotsRefresh: () => void;
}

// ── Event meta ────────────────────────────────────────────────────────────────

const EVENT_META: Record<OnboardingEvent, { icon: string; label: string; color: string }> = {
  member_joined:  { icon: '👤', label: 'Membro entrou',   color: '#f59e0b' },
  dm_sent:        { icon: '✉️', label: 'PV enviado',       color: '#10b981' },
  dm_blocked:     { icon: '🚫', label: 'PV bloqueado',     color: '#ef4444' },
  start_received: { icon: '▶️', label: 'Start recebido',   color: '#6366f1' },
  flow_started:   { icon: '🔀', label: 'Fluxo iniciado',   color: '#8b5cf6' },
};

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
      style={{ background: value ? '#10b981' : '#374151' }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: value ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: OnboardingLog }) {
  const meta = EVENT_META[log.event];
  const date = new Date(log.timestamp);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const day  = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      <span className="text-base shrink-0 mt-0.5">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
          <span className="text-xs text-gray-600">{log.botName}</span>
          {log.userName && <span className="text-xs text-gray-500">@{log.userName}</span>}
          {log.groupTitle && (
            <span className="text-xs text-gray-600 truncate max-w-[160px]">· {log.groupTitle}</span>
          )}
        </div>
        {log.error && (
          <p className="text-xs text-red-400 mt-0.5 truncate">{log.error}</p>
        )}
      </div>
      <span className="text-[10px] text-gray-700 shrink-0 tabular-nums">{day} {time}</span>
    </div>
  );
}

// ── Bot config form ───────────────────────────────────────────────────────────

function BotOnboardingForm({
  bot,
  flows,
  onSaved,
}: {
  bot: Bot;
  flows: Flow[];
  onSaved: (bot: Bot) => void;
}) {
  const [cfg, setCfg] = useState<OnboardingConfig>(() => ({
    ...DEFAULT_ONBOARDING,
    ...(bot.onboarding ?? {}),
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  // Reset when bot changes
  useEffect(() => {
    setCfg({ ...DEFAULT_ONBOARDING, ...(bot.onboarding ?? {}) });
    setSaved(false);
    setError('');
  }, [bot.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const botFlows = flows.filter((f) => f.botId === bot.id);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/bots/${bot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding: cfg }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const updated: Bot = await res.json();
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full bg-[#0d1117] border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 placeholder-gray-600 resize-none';

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl"
        style={{ background: cfg.enabled ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${cfg.enabled ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
        <div>
          <p className="text-sm font-semibold text-white">Ativar onboarding</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {cfg.enabled
              ? `Ativo para @${bot.username ?? bot.name}`
              : 'Desativado — novos membros não recebem mensagem'}
          </p>
        </div>
        <Toggle value={cfg.enabled} onChange={(v) => setCfg((c) => ({ ...c, enabled: v }))} />
      </div>

      {/* Flow selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Fluxo iniciado ao clicar
        </label>
        {botFlows.length === 0 ? (
          <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-500/20 rounded-lg px-3 py-2">
            Nenhum fluxo ativo encontrado para este bot. Crie um fluxo na aba Fluxos primeiro.
          </p>
        ) : (
          <select
            value={cfg.flowId}
            onChange={(e) => setCfg((c) => ({ ...c, flowId: e.target.value }))}
            className={field}
            style={{ cursor: 'pointer' }}>
            <option value="">— Selecionar fluxo —</option>
            {botFlows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.active ? '● ' : '○ '}{f.name}
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-gray-600 mt-1">
          Apenas fluxos ativos serão executados. O fluxo inicia no primeiro bloco após o gatilho.
        </p>
      </div>

      {/* Welcome message */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Mensagem no PV
        </label>
        <textarea
          rows={3}
          value={cfg.welcomeMessage}
          onChange={(e) => setCfg((c) => ({ ...c, welcomeMessage: e.target.value }))}
          placeholder="Olá! Seja bem-vindo(a)! Clique no botão abaixo para começar 👇"
          className={field}
        />
        <p className="text-xs text-gray-600 mt-1">
          Enviada no privado quando o membro entra no grupo.
        </p>
      </div>

      {/* Button text */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Texto do botão
        </label>
        <input
          type="text"
          value={cfg.buttonText}
          onChange={(e) => setCfg((c) => ({ ...c, buttonText: e.target.value }))}
          placeholder="🚀 Começar agora"
          className={field}
        />
        <p className="text-xs text-gray-600 mt-1">
          O botão abre <code className="text-gray-500">t.me/{bot.username ?? 'bot'}?start=welcome_…</code>
        </p>
      </div>

      {/* Fallback section */}
      <div className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.03)', borderBottom: cfg.fallbackEnabled ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <div>
            <p className="text-sm font-semibold text-white">Fallback no grupo</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Se o PV falhar (usuário nunca iniciou o bot), envia mensagem no grupo
            </p>
          </div>
          <Toggle value={cfg.fallbackEnabled} onChange={(v) => setCfg((c) => ({ ...c, fallbackEnabled: v }))} />
        </div>
        {cfg.fallbackEnabled && (
          <div className="px-4 py-3">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Mensagem no grupo
            </label>
            <textarea
              rows={2}
              value={cfg.fallbackMessage}
              onChange={(e) => setCfg((c) => ({ ...c, fallbackMessage: e.target.value }))}
              placeholder="Bem-vindo(a) ao grupo! Clique abaixo para receber sua mensagem de boas-vindas:"
              className={field}
            />
          </div>
        )}
      </div>

      {/* Preview */}
      {bot.username && (
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)' }}>
          <p className="text-xs font-semibold text-indigo-400 mb-2">Preview do deep link</p>
          <code className="text-xs text-indigo-300 break-all">
            https://t.me/{bot.username}?start=welcome_&#123;userId&#125;_&#123;groupId&#125;
          </code>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 text-sm font-semibold rounded-xl transition-all"
        style={{
          background: saved ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.12)',
          border: `1px solid ${saved ? 'rgba(16,185,129,0.6)' : 'rgba(16,185,129,0.3)'}`,
          color: saved ? '#6ee7b7' : '#34d399',
          opacity: saving ? 0.6 : 1,
        }}>
        {saving ? 'Salvando…' : saved ? '✓ Salvo!' : 'Salvar configuração'}
      </button>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function OnboardingPanel({ bots, onBotsRefresh }: Props) {
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [flows, setFlows]   = useState<Flow[]>([]);
  const [logs, setLogs]     = useState<OnboardingLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [localBots, setLocalBots] = useState<Bot[]>(bots);

  // Sync with parent
  useEffect(() => {
    setLocalBots(bots);
    if (!selectedBotId && bots.length > 0) setSelectedBotId(bots[0].id);
  }, [bots]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFlows = useCallback(async () => {
    const res = await fetch('/api/flows');
    if (res.ok) setFlows(await res.json());
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    const res = await fetch('/api/onboarding/logs');
    if (res.ok) setLogs(await res.json());
    setLoadingLogs(false);
  }, []);

  useEffect(() => {
    fetchFlows();
    fetchLogs();
  }, [fetchFlows, fetchLogs]);

  const clearLogs = async () => {
    await fetch('/api/onboarding/logs', { method: 'DELETE' });
    setLogs([]);
  };

  const handleBotSaved = (updated: Bot) => {
    const next = localBots.map((b) => b.id === updated.id ? updated : b);
    setLocalBots(next);
    onBotsRefresh();
  };

  const selectedBot = localBots.find((b) => b.id === selectedBotId);

  // Summary counts
  const counts = logs.reduce((acc, l) => {
    acc[l.event] = (acc[l.event] ?? 0) + 1;
    return acc;
  }, {} as Record<OnboardingEvent, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Onboarding de Novos Membros</h2>
        <p className="text-sm text-gray-500 mt-1">
          Quando alguém entra em um grupo onde o bot está presente, envie automaticamente
          uma mensagem no privado com um botão para iniciar um fluxo.
        </p>
      </div>

      {/* Stats bar */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(Object.keys(EVENT_META) as OnboardingEvent[]).map((ev) => {
            const meta = EVENT_META[ev];
            return (
              <div key={ev} className="rounded-xl px-3 py-2.5 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-lg">{meta.icon}</div>
                <div className="text-lg font-bold text-white tabular-nums">{counts[ev] ?? 0}</div>
                <div className="text-[10px] text-gray-500 leading-tight">{meta.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {bots.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-sm">Nenhum bot cadastrado.</p>
          <p className="text-xs mt-1">Adicione um bot na aba <strong className="text-gray-400">Bots</strong> primeiro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
          {/* Bot selector sidebar */}
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-2 mb-2">Bots</p>
            {localBots.map((b) => {
              const isActive = b.onboarding?.enabled;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBotId(b.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all"
                  style={selectedBotId === b.id
                    ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#fff' }
                    : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#9ca3af' }}>
                  <div className="flex items-center gap-2">
                    <span>{b.defaultEmoji}</span>
                    <span className="truncate font-medium">{b.name}</span>
                    {isActive && (
                      <span className="ml-auto text-[9px] font-bold text-emerald-400 bg-emerald-900/40 px-1.5 py-0.5 rounded-full shrink-0">ON</span>
                    )}
                  </div>
                  {b.username && (
                    <p className="text-[10px] text-gray-600 mt-0.5 pl-6">@{b.username}</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Config form */}
          <div className="rounded-2xl p-5"
            style={{ background: 'rgba(9,11,20,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {selectedBot ? (
              <BotOnboardingForm
                key={selectedBot.id}
                bot={selectedBot}
                flows={flows}
                onSaved={handleBotSaved}
              />
            ) : (
              <p className="text-sm text-gray-600 text-center py-8">Selecione um bot</p>
            )}
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(9,11,20,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Log header */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Logs de onboarding</span>
            {logs.length > 0 && (
              <span className="text-xs text-gray-600 bg-gray-800 rounded-full px-2 py-0.5">{logs.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchLogs} className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
              ↺ Atualizar
            </button>
            {logs.length > 0 && (
              <button onClick={clearLogs} className="text-xs text-red-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-900/10">
                Limpar
              </button>
            )}
          </div>
        </div>

        {loadingLogs ? (
          <div className="px-4 py-8 text-center text-sm text-gray-600">Carregando…</div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-sm text-gray-600">Nenhum evento de onboarding ainda.</p>
            <p className="text-xs text-gray-700 mt-1">
              Ative o onboarding em um bot e adicione-o a um grupo para ver os logs aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03] max-h-96 overflow-y-auto">
            {logs.map((l) => <LogRow key={l.id} log={l} />)}
          </div>
        )}
      </div>
    </div>
  );
}
