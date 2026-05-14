import { NextRequest, NextResponse } from 'next/server';
import { getBots, saveBots } from '@/lib/storage';
import { getMe } from '@/lib/telegram';
import { Bot } from '@/lib/types';

export async function GET() {
  try {
    const bots = await getBots();
    console.log(`[GET /api/bots] returning ${bots.length} bots`);
    return NextResponse.json(bots);
  } catch (err) {
    console.error('[GET /api/bots] storage error:', err);
    return NextResponse.json({ error: 'Falha ao ler bots do storage' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { name?: string; token?: string; defaultEmoji?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const { name, token, defaultEmoji } = body;

  if (!name?.trim() || !token?.trim()) {
    return NextResponse.json({ error: 'name e token são obrigatórios' }, { status: 400 });
  }

  // Validate token with Telegram
  console.log('[POST /api/bots] validating token with Telegram…');
  const info = await getMe(token.trim());
  if (!info.ok) {
    console.error('[POST /api/bots] invalid token:', info.error);
    return NextResponse.json({ error: `Token inválido: ${info.error}` }, { status: 400 });
  }
  console.log('[POST /api/bots] token valid, bot username:', info.username);

  // Load current list
  let bots: Bot[];
  try {
    bots = await getBots();
  } catch (err) {
    console.error('[POST /api/bots] failed to read existing bots:', err);
    return NextResponse.json({ error: 'Falha ao ler bots do storage' }, { status: 500 });
  }
  console.log(`[POST /api/bots] bots before insert: ${bots.length}`);

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

  // Save — if this throws, we return 500 instead of fake 201
  try {
    await saveBots(bots);
  } catch (err) {
    console.error('[POST /api/bots] saveBots FAILED:', err);
    return NextResponse.json(
      { error: `Falha ao salvar no storage: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }

  console.log(`[POST /api/bots] bots after insert: ${bots.length} — new bot id: ${newBot.id}`);
  return NextResponse.json(newBot, { status: 201 });
}
