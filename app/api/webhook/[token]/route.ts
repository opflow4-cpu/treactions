import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;
import { waitUntil } from '@vercel/functions';
import { getBots } from '@/lib/storage';
import { dispatchReactions } from '@/lib/reactions';

interface TelegramMessage {
  message_id: number;
  chat: { id: number; title?: string; username?: string; type: string };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Verify token belongs to a registered active bot
  const bots = await getBots();
  const bot = bots.find((b) => b.token === token);
  if (!bot) {
    return NextResponse.json({ ok: false, error: 'Unknown token' }, { status: 401 });
  }

  // Always respond 200 immediately so Telegram doesn't retry
  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message ?? update.channel_post;
  if (!msg || !bot.active) {
    return NextResponse.json({ ok: true });
  }

  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const chatTitle = msg.chat.title ?? msg.chat.username ?? String(chatId);

  // Fire reactions after returning the response
  waitUntil(dispatchReactions(chatId, messageId, chatTitle));

  return NextResponse.json({ ok: true });
}
