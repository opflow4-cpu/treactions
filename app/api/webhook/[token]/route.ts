import { NextRequest, NextResponse } from 'next/server';
export const maxDuration = 30;

import { waitUntil } from '@vercel/functions';
import { getBots } from '@/lib/storage';
import { dispatchReactions } from '@/lib/reactions';
import { handleFlowMessage, handleFlowCallback } from '@/lib/flow-executor';
import { handleNewMember, handleWelcomeStart } from '@/lib/onboarding';

interface TGUser    { id: number; first_name?: string; username?: string; is_bot?: boolean }
interface TGChat    { id: number; title?: string; username?: string; type: string }
interface TGMessage {
  message_id: number;
  chat: TGChat;
  from?: TGUser;
  text?: string;
  new_chat_members?: TGUser[];
}
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
  if (!msg) return NextResponse.json({ ok: true });

  const chatId    = msg.chat.id;
  const chatTitle = msg.chat.title ?? msg.chat.username ?? String(chatId);
  const text      = msg.text ?? '';

  // ── New member(s) joined the group ───────────────────────────────────────
  if (msg.new_chat_members && msg.new_chat_members.length > 0) {
    if (bot.active) {
      for (const member of msg.new_chat_members) {
        if (member.is_bot) continue; // ignore bots joining
        const userName = member.username ?? member.first_name;
        waitUntil(
          handleNewMember(token, bot, member.id, userName, chatId, chatTitle)
            .catch((e) => console.error('[webhook] onboarding new-member error:', e)),
        );
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (!bot.active) return NextResponse.json({ ok: true });

  // ── /start welcome_USERID_GROUPID deep-link ───────────────────────────────
  if (text.startsWith('/start welcome_') && msg.from) {
    const payload  = text.slice('/start '.length); // "welcome_USERID_GROUPID"
    const fromName = msg.from.username ?? msg.from.first_name;
    waitUntil(
      handleWelcomeStart(token, bot, msg.from.id, fromName, payload)
        .catch((e) => console.error('[webhook] welcome-start error:', e)),
    );
    return NextResponse.json({ ok: true });
  }

  // ── Normal message — reactions + flow triggers ────────────────────────────
  const msgId = msg.message_id;
  waitUntil(
    Promise.all([
      dispatchReactions(chatId, msgId, chatTitle),
      text
        ? handleFlowMessage(token, chatId, text).catch((e) => console.error('[webhook] flow error:', e))
        : Promise.resolve(),
    ]),
  );

  return NextResponse.json({ ok: true });
}
