import { NextResponse } from 'next/server';
import { getBots, getAllChats, saveChats } from '@/lib/storage';
import { getMe, getChatInfo, getChatMemberStatus } from '@/lib/telegram';
import type { BotChat } from '@/lib/types';

// ── GET — retorna todos os chats de todos os bots (dados em cache) ─────────────
export async function GET() {
  const bots = await getBots();
  const data  = await getAllChats(bots.map((b) => b.id));
  return NextResponse.json({ ok: true, data, bots });
}

// ── POST — atualiza status dos chats consultando a API do Telegram ─────────────
export async function POST() {
  const bots = await getBots();

  const errors: string[] = [];

  for (const bot of bots) {
    // Busca o user_id do bot para poder chamar getChatMember
    const meRes = await getMe(bot.token);
    const botUserId = meRes.ok && meRes.id ? meRes.id : null;

    const chats = await getAllChats([bot.id]).then((r) => r[bot.id] ?? []);
    if (chats.length === 0) continue;

    const updated: BotChat[] = [];

    for (const chat of chats) {
      try {
        // ── Consulta info do chat ───────────────────────────────────────────
        const infoRes = await getChatInfo(bot.token, chat.chatId);

        if (!infoRes.ok) {
          // Classifica o erro
          const desc  = infoRes.error.toLowerCase();
          const isChatNotFound =
            desc.includes('chat not found') ||
            desc.includes('forbidden')      ||
            desc.includes('bot was kicked') ||
            desc.includes('not a member');

          updated.push({
            ...chat,
            lastChecked: Date.now(),
            error: isChatNotFound
              ? 'Bot sem acesso ao chat ou chat inválido'
              : infoRes.error,
          });
          continue;
        }

        // ── Consulta papel do bot no chat ───────────────────────────────────
        let botRole = chat.botRole;
        if (botUserId) {
          const memberRes = await getChatMemberStatus(bot.token, chat.chatId, botUserId);
          if (memberRes.ok) botRole = memberRes.status;
        }

        updated.push({
          ...chat,
          title:       infoRes.title,
          type:        infoRes.type,
          username:    infoRes.username  ?? chat.username,
          memberCount: infoRes.memberCount,
          botRole,
          lastChecked: Date.now(),
          error:       undefined, // limpa erro anterior se agora funciona
        });
      } catch (e) {
        const msg = String(e);
        errors.push(`${bot.name} / ${chat.title}: ${msg}`);
        updated.push({ ...chat, lastChecked: Date.now(), error: msg });
      }
    }

    await saveChats(bot.id, updated);
  }

  const allData = await getAllChats(bots.map((b) => b.id));
  return NextResponse.json({ ok: true, data: allData, bots, errors });
}
