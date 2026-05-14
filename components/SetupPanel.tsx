'use client';
import { useState } from 'react';
import { Bot } from '@/lib/types';

interface Props {
  bots: Bot[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors shrink-0"
    >
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
  );
}

function CodeLine({ children }: { children: string }) {
  return (
    <div className="flex items-center bg-gray-900 rounded-lg px-3 py-2 font-mono text-xs text-emerald-300 overflow-x-auto">
      <span className="flex-1 break-all">{children}</span>
      <CopyButton text={children} />
    </div>
  );
}

export default function SetupPanel({ bots }: Props) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://SEU-APP.vercel.app';

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Step 1 */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-7 h-7 rounded-full bg-emerald-700 text-white text-sm font-bold flex items-center justify-center shrink-0">1</span>
          <h3 className="text-white font-medium">Crie bots no BotFather</h3>
        </div>
        <p className="text-sm text-gray-400 mb-3">
          Abra o Telegram, procure por <strong className="text-gray-200">@BotFather</strong> e
          crie quantos bots quiser com o comando <code className="text-emerald-400">/newbot</code>.
          Cada bot vai gerar um token único.
        </p>
        <CodeLine>https://t.me/BotFather</CodeLine>
      </div>

      {/* Step 2 */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-7 h-7 rounded-full bg-emerald-700 text-white text-sm font-bold flex items-center justify-center shrink-0">2</span>
          <h3 className="text-white font-medium">Adicione os bots ao grupo/canal</h3>
        </div>
        <p className="text-sm text-gray-400">
          Todos os bots cadastrados precisam ser <strong className="text-gray-200">adicionados como membros</strong> do
          grupo ou canal onde você quer que eles reajam. O bot precisa ter permissão para ler mensagens.
        </p>
      </div>

      {/* Step 3 */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-7 h-7 rounded-full bg-emerald-700 text-white text-sm font-bold flex items-center justify-center shrink-0">3</span>
          <h3 className="text-white font-medium">Cadastre os tokens aqui</h3>
        </div>
        <p className="text-sm text-gray-400">
          Na aba <strong className="text-gray-200">Bots</strong>, clique em{' '}
          <strong className="text-gray-200">Adicionar Bot</strong> e cole o token de cada bot.
          O sistema validará automaticamente o token com a API do Telegram.
        </p>
      </div>

      {/* Step 4 */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-7 h-7 rounded-full bg-emerald-700 text-white text-sm font-bold flex items-center justify-center shrink-0">4</span>
          <h3 className="text-white font-medium">Registre os webhooks</h3>
        </div>
        <p className="text-sm text-gray-400 mb-3">
          Na aba <strong className="text-gray-200">Bots</strong>, clique em{' '}
          <strong className="text-gray-200">🔗 Registrar Webhook</strong> para cada bot. Isso
          diz ao Telegram para enviar as atualizações do grupo para este servidor.
        </p>
        <p className="text-xs text-gray-500 mb-2">Formato da URL do webhook (gerado automaticamente):</p>
        <CodeLine>{`${origin}/api/webhook/{TOKEN_DO_BOT}`}</CodeLine>

        {bots.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">URLs dos seus bots atuais:</p>
            <div className="space-y-2">
              {bots.map((bot) => (
                <div key={bot.id}>
                  <span className="text-xs text-gray-400 block mb-1">{bot.name}</span>
                  <CodeLine>{`${origin}/api/webhook/${bot.token}`}</CodeLine>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step 5 – Deploy */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-7 h-7 rounded-full bg-blue-700 text-white text-sm font-bold flex items-center justify-center shrink-0">▲</span>
          <h3 className="text-white font-medium">Deploy na Vercel</h3>
        </div>
        <p className="text-sm text-gray-400 mb-3">
          Para publicar, conecte este repositório à Vercel e configure as variáveis de ambiente.
        </p>
        <div className="space-y-2 text-sm">
          <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-300 space-y-1">
            <div>
              <span className="text-gray-500"># Obrigatório para persistência de dados</span>
            </div>
            <div><span className="text-yellow-400">KV_REST_API_URL</span>=<span className="text-green-400">https://…upstash.io</span></div>
            <div><span className="text-yellow-400">KV_REST_API_TOKEN</span>=<span className="text-green-400">seu-token-upstash</span></div>
            <div className="pt-1">
              <span className="text-gray-500"># Opcional: protege o painel com senha</span>
            </div>
            <div><span className="text-yellow-400">ADMIN_SECRET</span>=<span className="text-green-400">sua-senha-secreta</span></div>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500 space-y-1">
          <p>
            📦 <strong className="text-gray-400">Upstash Redis</strong> (gratuito) é necessário
            para persistir bots, config e logs em produção.
          </p>
          <p>
            Acesse <strong className="text-gray-400">upstash.com</strong>, crie um banco Redis e
            copie as credenciais REST API para as variáveis acima.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
        <h3 className="text-white font-medium mb-3">Como funciona</h3>
        <ol className="space-y-2 text-sm text-gray-400">
          <li className="flex gap-2">
            <span className="text-emerald-500 shrink-0">→</span>
            Uma mensagem chega no grupo onde os bots estão.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500 shrink-0">→</span>
            O Telegram envia o update para o webhook do bot que recebeu.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500 shrink-0">→</span>
            O servidor seleciona aleatoriamente N bots ativos (conforme &quot;Máximo por mensagem&quot;).
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500 shrink-0">→</span>
            Cada bot aguarda um delay aleatório e então chama <code className="text-emerald-400 text-xs">setMessageReaction</code>.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500 shrink-0">→</span>
            O sistema garante que o mesmo bot não reaja duas vezes à mesma mensagem.
          </li>
        </ol>
      </div>
    </div>
  );
}
