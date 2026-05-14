'use client';
import { useState } from 'react';
import { Bot } from '@/lib/types';

interface Props {
  bots: Bot[];
  onRefresh: () => void;
}

const EMOJI_OPTIONS = ['👍','❤️','🔥','🥰','👏','😍','🤩','💯','🎉','✨','😂','🤣','😎','🙏','💪'];

function maskToken(token: string) {
  const parts = token.split(':');
  if (parts.length !== 2) return token.slice(0, 6) + '…' + token.slice(-4);
  return `${parts[0]}:${parts[1].slice(0, 4)}…${parts[1].slice(-4)}`;
}

export default function BotsPanel({ bots, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editBot, setEditBot] = useState<Bot | null>(null);
  const [form, setForm] = useState({ name: '', token: '', defaultEmoji: '👍' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<Record<string, string>>({});

  const openAdd = () => {
    setEditBot(null);
    setForm({ name: '', token: '', defaultEmoji: '👍' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (bot: Bot) => {
    setEditBot(bot);
    setForm({ name: bot.name, token: '', defaultEmoji: bot.defaultEmoji });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setError('');
  };

  const handleSubmit = async () => {
    // Client-side validation
    if (!form.name.trim()) {
      setError('Preencha o nome do bot.');
      return;
    }
    if (!editBot && !form.token.trim()) {
      setError('Cole o token do BotFather.');
      return;
    }

    setError('');
    setSaving(true);
    console.log('[BotsPanel] handleSubmit start', { editBot: editBot?.id, name: form.name });

    try {
      let res: Response;

      if (editBot) {
        const payload = { name: form.name.trim(), defaultEmoji: form.defaultEmoji };
        console.log('[BotsPanel] PUT /api/bots/' + editBot.id, payload);
        res = await fetch(`/api/bots/${editBot.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        const payload = {
          name: form.name.trim(),
          token: form.token.trim(),
          defaultEmoji: form.defaultEmoji,
        };
        console.log('[BotsPanel] POST /api/bots', { name: payload.name, tokenLength: payload.token.length });
        res = await fetch('/api/bots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      console.log('[BotsPanel] response status:', res.status, res.statusText);

      // Always read the body once
      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error('[BotsPanel] failed to parse response JSON:', parseErr);
        setError('Resposta inválida do servidor. Verifique os logs da Vercel.');
        return;
      }

      console.log('[BotsPanel] response body:', data);

      if (!res.ok) {
        const msg = (data.error as string) ?? `Erro HTTP ${res.status}`;
        console.error('[BotsPanel] API error:', msg);
        setError(msg);
        return;
      }

      // Success
      console.log('[BotsPanel] success, closing modal and refreshing list');
      closeModal();
      onRefresh();
    } catch (err: unknown) {
      // Network / CORS / parse errors
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[BotsPanel] fetch threw an exception:', msg, err);
      setError(`Erro de rede: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (bot: Bot) => {
    console.log('[BotsPanel] toggleActive', bot.id, !bot.active);
    try {
      await fetch(`/api/bots/${bot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !bot.active }),
      });
    } catch (err) {
      console.error('[BotsPanel] toggleActive error:', err);
    }
    onRefresh();
  };

  const deleteBot = async (bot: Bot) => {
    if (!confirm(`Remover bot "${bot.name}"?`)) return;
    console.log('[BotsPanel] delete bot', bot.id);
    try {
      await fetch(`/api/bots/${bot.id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('[BotsPanel] deleteBot error:', err);
    }
    onRefresh();
  };

  const registerWebhook = async (bot: Bot) => {
    setWebhookStatus((s) => ({ ...s, [bot.id]: 'loading' }));
    const baseUrl = window.location.origin;
    console.log('[BotsPanel] registerWebhook', bot.id, baseUrl);
    try {
      const res = await fetch(`/api/bots/${bot.id}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl }),
      });
      const data = await res.json();
      console.log('[BotsPanel] registerWebhook response:', res.status, data);
      setWebhookStatus((s) => ({
        ...s,
        [bot.id]: res.ok ? `✓ ${data.webhookUrl}` : `✗ ${data.error ?? 'erro desconhecido'}`,
      }));
    } catch (err) {
      console.error('[BotsPanel] registerWebhook error:', err);
      setWebhookStatus((s) => ({ ...s, [bot.id]: `✗ Erro de rede` }));
    }
  };

  const removeWebhook = async (bot: Bot) => {
    setWebhookStatus((s) => ({ ...s, [bot.id]: 'loading' }));
    console.log('[BotsPanel] removeWebhook', bot.id);
    try {
      const res = await fetch(`/api/bots/${bot.id}/webhook`, { method: 'DELETE' });
      const data = await res.json();
      console.log('[BotsPanel] removeWebhook response:', res.status, data);
      setWebhookStatus((s) => ({
        ...s,
        [bot.id]: res.ok ? '✓ Webhook removido' : `✗ ${data.error ?? 'erro desconhecido'}`,
      }));
    } catch (err) {
      console.error('[BotsPanel] removeWebhook error:', err);
      setWebhookStatus((s) => ({ ...s, [bot.id]: `✗ Erro de rede` }));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Bots cadastrados ({bots.length})</h2>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Adicionar Bot
        </button>
      </div>

      {bots.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">🤖</div>
          <p>Nenhum bot cadastrado.</p>
          <p className="text-sm mt-1">Clique em &ldquo;Adicionar Bot&rdquo; para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bots.map((bot) => (
            <div key={bot.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{bot.defaultEmoji}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{bot.name}</span>
                      {bot.username && (
                        <span className="text-xs text-gray-400">@{bot.username}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">
                      {maskToken(bot.token)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(bot)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      bot.active
                        ? 'bg-emerald-900 text-emerald-300 hover:bg-emerald-800'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {bot.active ? '● Ativo' : '○ Inativo'}
                  </button>
                  <button
                    onClick={() => openEdit(bot)}
                    className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteBot(bot)}
                    className="px-3 py-1 text-xs bg-red-900 hover:bg-red-800 text-red-300 rounded-lg transition-colors"
                  >
                    Remover
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => registerWebhook(bot)}
                  disabled={webhookStatus[bot.id] === 'loading'}
                  className="px-3 py-1 text-xs bg-blue-900 hover:bg-blue-800 text-blue-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  {webhookStatus[bot.id] === 'loading' ? '⏳ Aguarde…' : '🔗 Registrar Webhook'}
                </button>
                <button
                  onClick={() => removeWebhook(bot)}
                  disabled={webhookStatus[bot.id] === 'loading'}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-400 rounded-lg transition-colors disabled:opacity-50"
                >
                  Remover Webhook
                </button>
                {webhookStatus[bot.id] && webhookStatus[bot.id] !== 'loading' && (
                  <span
                    className={`text-xs break-all ${
                      webhookStatus[bot.id].startsWith('✓') ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {webhookStatus[bot.id]}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editBot ? 'Editar Bot' : 'Adicionar Bot'}
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome do bot</label>
                <input
                  autoFocus
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="Ex: Bot Reações 1"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Token (add only) */}
              {!editBot && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Token do BotFather
                  </label>
                  <input
                    type="text"
                    value={form.token}
                    onChange={(e) => setForm((f) => ({ ...f, token: e.target.value.trim() }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="123456789:ABCdef…"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Obtenha o token em @BotFather com o comando /newbot
                  </p>
                </div>
              )}

              {/* Default emoji */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Emoji padrão</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, defaultEmoji: emoji }))}
                      className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                        form.defaultEmoji === emoji
                          ? 'bg-emerald-700 ring-2 ring-emerald-400'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error box */}
              {error && (
                <div className="text-sm text-red-300 bg-red-900/40 border border-red-700/50 rounded-lg px-3 py-2">
                  ✗ {error}
                </div>
              )}

              {/* Saving spinner hint */}
              {saving && (
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-gray-500 border-t-emerald-400 rounded-full animate-spin" />
                  Validando token com o Telegram…
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {saving ? 'Salvando…' : editBot ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
