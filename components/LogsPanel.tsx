'use client';
import { useState, useEffect, useCallback } from 'react';
import { ReactionLog } from '@/lib/types';

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s atrás`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return new Date(ts).toLocaleDateString('pt-BR');
}

export default function LogsPanel() {
  const [logs, setLogs] = useState<ReactionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');

  const fetchLogs = useCallback(async () => {
    const res = await fetch('/api/logs');
    if (res.ok) setLogs(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchLogs, 15_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLogs]);

  const clearLogs = async () => {
    if (!confirm('Limpar todos os logs?')) return;
    await fetch('/api/logs', { method: 'DELETE' });
    setLogs([]);
  };

  const visible = logs.filter((l) => {
    if (filter === 'success') return l.success;
    if (filter === 'error') return !l.success;
    return true;
  });

  const successCount = logs.filter((l) => l.success).length;
  const errorCount = logs.filter((l) => !l.success).length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Logs de reações</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            {logs.length} total
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-emerald-500"
            />
            Auto-refresh (15s)
          </label>
          <button
            onClick={fetchLogs}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
          >
            ↻ Atualizar
          </button>
          <button
            onClick={clearLogs}
            className="px-3 py-1 text-xs bg-red-900 hover:bg-red-800 text-red-300 rounded-lg transition-colors"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {logs.length > 0 && (
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === 'all' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Todos ({logs.length})
          </button>
          <button
            onClick={() => setFilter('success')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === 'success'
                ? 'bg-emerald-700 text-emerald-200'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            ✓ Sucesso ({successCount})
          </button>
          <button
            onClick={() => setFilter('error')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === 'error'
                ? 'bg-red-800 text-red-200'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            ✗ Erros ({errorCount})
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Carregando…</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">📋</div>
          <p>{logs.length === 0 ? 'Nenhuma reação registrada ainda.' : 'Nenhum log para esse filtro.'}</p>
          <p className="text-sm mt-1 text-gray-600">
            As reações aparecem aqui quando os bots reagem a mensagens.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4 font-medium">Horário</th>
                <th className="pb-2 pr-4 font-medium">Bot</th>
                <th className="pb-2 pr-4 font-medium">Chat</th>
                <th className="pb-2 pr-4 font-medium">Msg ID</th>
                <th className="pb-2 pr-4 font-medium">Emoji</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {visible.map((log) => (
                <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 pr-4 text-gray-500 whitespace-nowrap text-xs">
                    {timeAgo(log.timestamp)}
                  </td>
                  <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">{log.botName}</td>
                  <td className="py-2 pr-4 text-gray-300 max-w-[160px] truncate">
                    {log.chatTitle}
                  </td>
                  <td className="py-2 pr-4 text-gray-500 font-mono text-xs">{log.messageId}</td>
                  <td className="py-2 pr-4 text-lg">{log.emoji}</td>
                  <td className="py-2">
                    {log.success ? (
                      <span className="text-emerald-400 text-xs">✓ ok</span>
                    ) : (
                      <span
                        className="text-red-400 text-xs"
                        title={log.error}
                      >
                        ✗ {log.error ? log.error.slice(0, 30) : 'erro'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
