import { NextRequest, NextResponse } from 'next/server';
import { getBots, saveBots } from '@/lib/storage';
import { getMe } from '@/lib/telegram';
import { Bot } from '@/lib/types';

export async function GET() {
  const bots = await getBots();
  return NextResponse.json(bots);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name: string; token: string; defaultEmoji: string };
  const { name, token, defaultEmoji } = body;

  if (!name?.trim() || !token?.trim()) {
    return NextResponse.json({ error: 'name and token are required' }, { status: 400 });
  }

  // Validate token with Telegram
  const info = await getMe(token.trim());
  if (!info.ok) {
    return NextResponse.json({ error: `Token inválido: ${info.error}` }, { status: 400 });
  }

  const bots = await getBots();

  // Prevent duplicate tokens
  if (bots.some((b) => b.token === token.trim())) {
    return NextResponse.json({ error: 'Esse token já está cadastrado' }, { status: 409 });
  }

  const newBot: Bot = {
    id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    token: token.trim(),
    active: true,
    defaultEmoji: defaultEmoji || '👍',
    username: info.username,
    createdAt: Date.now(),
  };

  bots.push(newBot);
  await saveBots(bots);

  return NextResponse.json(newBot, { status: 201 });
}
