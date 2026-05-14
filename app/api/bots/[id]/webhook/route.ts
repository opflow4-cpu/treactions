import { NextRequest, NextResponse } from 'next/server';
import { getBots } from '@/lib/storage';
import { setWebhook, deleteWebhook } from '@/lib/telegram';

type Ctx = { params: Promise<{ id: string }> };

// POST → register webhook    DELETE → remove webhook
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const bots = await getBots();
  const bot = bots.find((b) => b.id === id);
  if (!bot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json()) as { baseUrl: string };
  if (!body.baseUrl) {
    return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
  }

  const webhookUrl = `${body.baseUrl.replace(/\/$/, '')}/api/webhook/${bot.token}`;
  const result = await setWebhook(bot.token, webhookUrl);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, webhookUrl });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const bots = await getBots();
  const bot = bots.find((b) => b.id === id);
  if (!bot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const result = await deleteWebhook(bot.token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
