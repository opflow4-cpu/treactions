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

  const closeModal = () => { setShowModal(false); setError(''); };

  const handleSubmit = async () => {
    setError('');
    setSaving(true);
    try {
      if (editBot) {
        const res = await fetch(`/api/bots/${editBot.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, defaultEmoji: form.defaultEmoji }),
        });
        if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      } else {
        const res = await fetch('/api/bots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      }
      closeModal();
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (bot: Bot) => {
    await fetch(`/api/bots/${bot.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !bot.active }),
    });
    onRefresh();
  };

  const deleteBot = async (bot: Bot) => {
    if (!confirm(`Remover bot "${bot.name}"?`)) return;
    await fetch(`/api/bots/${bot.id}`, { method: 'DELETE' });
    onRefresh();
  };

  const setWebhook = async (bot: Bot) => {
    setWebhookStatus((s) => ({ ...s, [bot.id]: 'loading' }));
    const baseUrl = window.location.origin;
    const res = await fetch(`/api/bots/${bot.id}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl }),
    });
    const data = await res.json();
    setWebhookStatus((s) => ({
      ...s,
      [bot.id]: res.ok ? `✓ ${data.webhookUrl}` : `✗ ${data.error}`,
    }));
  };

  const removeWebhook = async (bot: Bot) => {
    setWebhookStatus((s) => ({ ...s, [bot.id]: 'loading' }));
    const res = await fetch(`/api/bots/${bot.id}/webhook`, { method: 'DELETE' });
    const data = await res.json();
    setWebhookStatus((s) => ({
      ...s,
      [bot.id]: res.ok ? '✓ Webhook removido' : `✗ ${data.error}`,
    }));
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
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{maskToken(bot.token)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle active */}
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

              {/* Webhook controls */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setWebhook(bot)}
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
                    className={`text-xs truncate max-w-xs ${
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editBot ? 'Editar Bot' : 'Adicionar Bot'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome do bot</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Bot Reações 1"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {!editBot && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Token do BotFather
                  </label>
                  <input
                    type="text"
                    value={form.token}
                    onChange={(e) => setForm((f) => ({ ...f, token: e.target.value.trim() }))}
                    placeholder="123456789:ABCdef..."
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Obtenha o token em @BotFather com o comando /newbot
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">Emoji padrão</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
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

              {error && (
                <p className="text-sm text-red-400 bg-red-900/30 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando…' : editBot ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
