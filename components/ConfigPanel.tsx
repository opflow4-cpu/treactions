'use client';
import { useState } from 'react';
import { GlobalConfig } from '@/lib/types';

interface Props {
  config: GlobalConfig;
  onSaved: (config: GlobalConfig) => void;
}

const EMOJI_SUGGESTIONS = [
  '👍','❤️','🔥','🥰','👏','😍','🤩','💯','🎉','✨',
  '😂','🤣','😎','🙏','💪','🫡','👀','💅','🥹','😭',
  '🎊','🏆','⚡','🌟','💫','🫶','🤝','👋','🙌','🤙',
];

export default function ConfigPanel({ config, onSaved }: Props) {
  const [form, setForm] = useState<GlobalConfig>({ ...config });
  const [emojiInput, setEmojiInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const updated = await res.json();
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const addEmoji = (emoji: string) => {
    if (!form.emojiPool.includes(emoji)) {
      setForm((f) => ({ ...f, emojiPool: [...f.emojiPool, emoji] }));
    }
  };

  const removeEmoji = (emoji: string) => {
    setForm((f) => ({ ...f, emojiPool: f.emojiPool.filter((e) => e !== emoji) }));
  };

  const addCustomEmoji = () => {
    const trimmed = emojiInput.trim();
    if (trimmed && !form.emojiPool.includes(trimmed)) {
      setForm((f) => ({ ...f, emojiPool: [...f.emojiPool, trimmed] }));
      setEmojiInput('');
    }
  };

  const totalDelayWarning = form.delayMax > 8000;

  return (
    <div className="space-y-6 max-w-xl">
      {/* Max bots per message */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <h3 className="text-white font-medium mb-4">Reações por mensagem</h3>
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Máximo de bots reagindo por mensagem
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={form.maxBotsPerMessage}
            onChange={(e) =>
              setForm((f) => ({ ...f, maxBotsPerMessage: Number(e.target.value) }))
            }
            className="w-32 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Se você tiver 10 bots e definir 5, apenas 5 bots aleatórios vão reagir por mensagem.
          </p>
        </div>
      </div>

      {/* Delay settings */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <h3 className="text-white font-medium mb-4">Delay entre reações</h3>
        <p className="text-xs text-gray-500 mb-4">
          Cada bot espera um tempo aleatório entre os valores abaixo antes de reagir, tornando
          as reações mais naturais.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Mínimo (ms)</label>
            <input
              type="number"
              min={0}
              max={30000}
              step={100}
              value={form.delayMin}
              onChange={(e) => setForm((f) => ({ ...f, delayMin: Number(e.target.value) }))}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-gray-600 mt-1">{(form.delayMin / 1000).toFixed(1)}s</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Máximo (ms)</label>
            <input
              type="number"
              min={0}
              max={30000}
              step={100}
              value={form.delayMax}
              onChange={(e) => setForm((f) => ({ ...f, delayMax: Number(e.target.value) }))}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-gray-600 mt-1">{(form.delayMax / 1000).toFixed(1)}s</p>
          </div>
        </div>
        {totalDelayWarning && (
          <div className="mt-3 text-xs text-yellow-400 bg-yellow-900/30 rounded-lg px-3 py-2">
            ⚠️ Delay máximo acima de 8s pode causar timeout na Vercel (plano gratuito = 10s por
            função). Considere reduzir ou fazer upgrade.
          </div>
        )}
      </div>

      {/* Emoji pool */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-medium">Pool de emojis</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-400">Aleatório</span>
            <button
              onClick={() => setForm((f) => ({ ...f, useRandomEmoji: !f.useRandomEmoji }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                form.useRandomEmoji ? 'bg-emerald-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  form.useRandomEmoji ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {form.useRandomEmoji
            ? 'Cada bot vai reagir com um emoji aleatório desse pool.'
            : 'Cada bot vai usar seu emoji padrão definido no cadastro.'}
        </p>

        {/* Active pool */}
        <div className="flex flex-wrap gap-2 mb-3 min-h-[2.5rem]">
          {form.emojiPool.map((emoji) => (
            <button
              key={emoji}
              onClick={() => removeEmoji(emoji)}
              title="Clique para remover"
              className="text-xl w-9 h-9 rounded-lg bg-emerald-900/50 border border-emerald-700 flex items-center justify-center hover:bg-red-900/50 hover:border-red-700 transition-colors"
            >
              {emoji}
            </button>
          ))}
          {form.emojiPool.length === 0 && (
            <span className="text-sm text-gray-600">Adicione emojis abaixo</span>
          )}
        </div>

        {/* Suggestions */}
        <p className="text-xs text-gray-500 mb-2">Sugestões (clique para adicionar):</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {EMOJI_SUGGESTIONS.filter((e) => !form.emojiPool.includes(e)).map((emoji) => (
            <button
              key={emoji}
              onClick={() => addEmoji(emoji)}
              className="text-xl w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Custom emoji input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={emojiInput}
            onChange={(e) => setEmojiInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomEmoji()}
            placeholder="Cole um emoji personalizado…"
            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={addCustomEmoji}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
      >
        {saved ? '✓ Salvo!' : saving ? 'Salvando…' : 'Salvar configurações'}
      </button>
    </div>
  );
}
