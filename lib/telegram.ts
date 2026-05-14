const TG = 'https://api.telegram.org';

export async function getMe(
  token: string,
): Promise<{ ok: boolean; name?: string; username?: string; error?: string }> {
  try {
    const res = await fetch(`${TG}/bot${token}/getMe`);
    const data = (await res.json()) as {
      ok: boolean;
      result?: { first_name: string; username: string };
      description?: string;
    };
    if (!data.ok) return { ok: false, error: data.description };
    return { ok: true, name: data.result!.first_name, username: data.result!.username };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function setWebhook(
  token: string,
  webhookUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${TG}/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'channel_post'] }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    return { ok: data.ok, error: data.description };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function deleteWebhook(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${TG}/bot${token}/deleteWebhook`, { method: 'POST' });
    const data = (await res.json()) as { ok: boolean; description?: string };
    return { ok: data.ok, error: data.description };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function sendReaction(
  token: string,
  chatId: number | string,
  messageId: number,
  emoji: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${TG}/bot${token}/setMessageReaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reaction: [{ type: 'emoji', emoji }],
        is_big: false,
      }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    return { ok: data.ok, error: data.description };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
