import { NextRequest, NextResponse } from 'next/server';
export const maxDuration = 30;

import { waitUntil } from '@vercel/functions';
import { getBots } from '@/lib/storage';
import { dispatchReactions } from '@/lib/reactions';
import { handleFlowMessage, handleFlowCallback } from '@/lib/flow-executor';

interface TGUser    { id: number; first_name?: string; username?: string }
interface TGChat    { id: number; title?: string; username?: string; type: string }
interface TGMessage { message_id: number; chat: TGChat; from?: TGUser; text?: string }
interface TGCallback {
  id: string;
  from: TGUser;
  message: TGMessage;
  data?: string;
}
interface TGUpdate {
  update_id: number;
  message?:        TGMessage;
  channel_post?:   TGMessage;
  callback_query?: TGCallback;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const bots = await getBots();
  const bot = bots.find((b) => b.token === token);
  if (!bot) return NextResponse.json({ ok: false, error: 'Unknown token' }, { status: 401 });

  let update: TGUpdate;
  try { update = (await req.json()) as TGUpdate; }
  catch { return NextResponse.json({ ok: true }); }

  // ── Button callback ───────────────────────────────────────────────────────
  if (update.callback_query) {
    const cb = update.callback_query;
    if (cb.data && bot.active) {
      waitUntil(
        handleFlowCallback(token, cb.id, cb.message.chat.id, cb.data)
          .catch((e) => console.error('[webhook] callback error:', e)),
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ── Regular message / channel post ───────────────────────────────────────
  const msg = update.message ?? update.channel_post;
  if (!msg || !bot.active) return NextResponse.json({ ok: true });

  const chatId   = msg.chat.id;
  const msgId    = msg.message_id;
  const chatTitle = msg.chat.title ?? msg.chat.username ?? String(chatId);
  const text     = msg.text ?? '';

  waitUntil(
    Promise.all([
      dispatchReactions(chatId, msgId, chatTitle),
      text ? handleFlowMessage(token, chatId, text).catch((e) => console.error('[webhook] flow error:', e)) : Promise.resolve(),
    ]),
  );

  return NextResponse.json({ ok: true });
}
