import { NextRequest, NextResponse } from 'next/server';
export const maxDuration = 30;

import { waitUntil } from '@vercel/functions';
import { getBots, upsertChat, appendMemberEvent } from '@/lib/storage';
import { dispatchReactions } from '@/lib/reactions';
import { handleFlowMessage, handleFlowCallback } from '@/lib/flow-executor';
import type { ChatKind, MemberEvent } from '@/lib/types';

interface TGUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  is_bot?: boolean;
}
interface TGChat    { id: number; title?: string; username?: string; type: string }
interface TGMessage {
  message_id: number;
  chat: TGChat;
  from?: TGUser;
  text?: string;
  new_chat_members?: TGUser[];
  left_chat_member?: TGUser;
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
  const chatType  = (msg.chat.type as ChatKind) ?? 'group';

  // ── Service messages: member join / leave ─────────────────────────────────
  const memberTasks: Promise<void>[] = [];

  if (bot.active) {
    // new_chat_members — can be an array of users
    if (msg.new_chat_members && msg.new_chat_members.length > 0) {
      for (const user of msg.new_chat_members) {
        if (user.is_bot) continue; // skip bots
        const ev: MemberEvent = {
          id:        `me_${Date.now().toString(36)}_${user.id}`,
          timestamp: Date.now(),
          chatId,
          chatTitle,
          userId:    user.id,
          firstName: user.first_name ?? '',
          lastName:  user.last_name,
          username:  user.username,
          event:     'joined',
          botId:     bot.id,
          botName:   bot.name,
        };
        memberTasks.push(appendMemberEvent(ev).catch(() => {}));
      }
    }

    // left_chat_member — single user
    if (msg.left_chat_member && !msg.left_chat_member.is_bot) {
      const user = msg.left_chat_member;
      const ev: MemberEvent = {
        id:        `me_${Date.now().toString(36)}_${user.id}`,
        timestamp: Date.now(),
        chatId,
        chatTitle,
        userId:    user.id,
        firstName: user.first_name ?? '',
        lastName:  user.last_name,
        username:  user.username,
        event:     'left',
        botId:     bot.id,
        botName:   bot.name,
      };
      memberTasks.push(appendMemberEvent(ev).catch(() => {}));
    }
  }

  // If this is a pure service message (join/leave with no text), skip reactions + flow
  const isServiceMessage = !!(msg.new_chat_members || msg.left_chat_member);

  waitUntil(
    Promise.all([
      // Always keep the chat registry up to date
      upsertChat(bot.id, {
        chatId,
        title:    chatTitle,
        type:     chatType,
        username: msg.chat.username,
      }).catch(() => {}),

      // Propagate member events
      ...memberTasks,

      // Reactions + flows only for real messages
      ...(bot.active && !isServiceMessage
        ? [
            dispatchReactions(chatId, msg.message_id, chatTitle),
            msg.text
              ? handleFlowMessage(token, chatId, msg.text).catch((e) => console.error('[webhook] flow error:', e))
              : Promise.resolve(),
          ]
        : []),
    ]),
  );

  return NextResponse.json({ ok: true });
}
