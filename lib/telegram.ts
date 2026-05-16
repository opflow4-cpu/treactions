import type { BotRole, ChatKind } from './types';

const TG = 'https://api.telegram.org';

type TGResponse<T = unknown> = { ok: boolean; result?: T; description?: string };

async function tgPost<T = unknown>(token: string, method: string, body: object): Promise<TGResponse<T>> {
  try {
    const res = await fetch(`${TG}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await res.json()) as TGResponse<T>;
  } catch (e) {
    return { ok: false, description: String(e) };
  }
}

export async function getMe(
  token: string,
): Promise<{ ok: boolean; id?: number; name?: string; username?: string; error?: string }> {
  try {
    const res  = await fetch(`${TG}/bot${token}/getMe`);
    const data = (await res.json()) as TGResponse<{ id: number; first_name: string; username: string }>;
    if (!data.ok) return { ok: false, error: data.description };
    return { ok: true, id: data.result!.id, name: data.result!.first_name, username: data.result!.username };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Chat info ─────────────────────────────────────────────────────────────────

export interface TGChatInfo {
  ok:            true;
  title:         string;
  type:          ChatKind;
  username?:     string;
  memberCount?:  number;
}

export async function getChatInfo(
  token: string,
  chatId: number | string,
): Promise<TGChatInfo | { ok: false; error: string }> {
  const data = await tgPost<{
    title?: string; type: string; username?: string; member_count?: number;
  }>(token, 'getChat', { chat_id: chatId });

  if (!data.ok || !data.result) {
    return { ok: false, error: data.description ?? 'Erro desconhecido' };
  }

  const r = data.result;
  return {
    ok:          true,
    title:       r.title ?? String(chatId),
    type:        (r.type as ChatKind) ?? 'group',
    username:    r.username,
    memberCount: r.member_count,
  };
}

export async function getChatMemberStatus(
  token: string,
  chatId: number | string,
  userId: number,
): Promise<{ ok: true; status: BotRole } | { ok: false; error: string }> {
  const data = await tgPost<{ status: string }>(
    token, 'getChatMember', { chat_id: chatId, user_id: userId },
  );

  if (!data.ok || !data.result) {
    return { ok: false, error: data.description ?? 'Erro desconhecido' };
  }

  return { ok: true, status: (data.result.status as BotRole) ?? 'unknown' };
}

export async function setWebhook(
  token: string,
  webhookUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const data = await tgPost(token, 'setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'channel_post', 'callback_query'],
  });
  return { ok: data.ok, error: data.description };
}

export async function deleteWebhook(token: string): Promise<{ ok: boolean; error?: string }> {
  const data = await tgPost(token, 'deleteWebhook', {});
  return { ok: data.ok, error: data.description };
}

export async function sendReaction(
  token: string,
  chatId: number | string,
  messageId: number,
  emoji: string,
): Promise<{ ok: boolean; error?: string }> {
  const data = await tgPost(token, 'setMessageReaction', {
    chat_id: chatId,
    message_id: messageId,
    reaction: [{ type: 'emoji', emoji }],
    is_big: false,
  });
  return { ok: data.ok, error: data.description };
}

export async function sendChatAction(
  token: string,
  chatId: number | string,
  action: string,
): Promise<{ ok: boolean; error?: string }> {
  const data = await tgPost(token, 'sendChatAction', { chat_id: chatId, action });
  return { ok: data.ok, error: data.description };
}

export async function sendMessage(
  token: string,
  chatId: number | string,
  text: string,
  extra?: { parse_mode?: string; reply_markup?: object },
): Promise<{ ok: boolean; error?: string }> {
  const data = await tgPost(token, 'sendMessage', { chat_id: chatId, text, ...extra });
  return { ok: data.ok, error: data.description };
}

export async function sendPhoto(
  token: string,
  chatId: number | string,
  photo: string,
  caption?: string,
): Promise<{ ok: boolean; error?: string }> {
  const data = await tgPost(token, 'sendPhoto', { chat_id: chatId, photo, caption });
  return { ok: data.ok, error: data.description };
}

export async function sendVideo(
  token: string,
  chatId: number | string,
  video: string,
  caption?: string,
): Promise<{ ok: boolean; error?: string }> {
  const data = await tgPost(token, 'sendVideo', { chat_id: chatId, video, caption });
  return { ok: data.ok, error: data.description };
}

export async function sendAudio(
  token: string,
  chatId: number | string,
  audio: string,
): Promise<{ ok: boolean; error?: string }> {
  const data = await tgPost(token, 'sendAudio', { chat_id: chatId, audio });
  return { ok: data.ok, error: data.description };
}

export async function sendDocument(
  token: string,
  chatId: number | string,
  document: string,
  caption?: string,
): Promise<{ ok: boolean; error?: string }> {
  const data = await tgPost(token, 'sendDocument', { chat_id: chatId, document, caption });
  return { ok: data.ok, error: data.description };
}

export interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export async function sendInlineButtons(
  token: string,
  chatId: number | string,
  text: string,
  rows: InlineButton[][],
): Promise<{ ok: boolean; error?: string }> {
  const data = await tgPost(token, 'sendMessage', {
    chat_id: chatId,
    text: text || '.',
    reply_markup: { inline_keyboard: rows },
  });
  return { ok: data.ok, error: data.description };
}

export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
): Promise<{ ok: boolean; error?: string }> {
  const data = await tgPost(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
  return { ok: data.ok, error: data.description };
}
