import { NextRequest, NextResponse } from 'next/server';
import { getBots, saveBots } from '@/lib/storage';
import { Bot } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const bots = await getBots();
  const bot = bots.find((b) => b.id === id);
  if (!bot) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(bot);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const bots = await getBots();
  const idx = bots.findIndex((b) => b.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json()) as Partial<Bot>;
  // Only allow updating safe fields
  const allowed: (keyof Bot)[] = ['name', 'active', 'defaultEmoji', 'onboarding'];
  for (const key of allowed) {
    if (key in body) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (bots[idx] as any)[key] = body[key];
    }
  }

  await saveBots(bots);
  return NextResponse.json(bots[idx]);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const bots = await getBots();
  const filtered = bots.filter((b) => b.id !== id);
  if (filtered.length === bots.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await saveBots(filtered);
  return NextResponse.json({ ok: true });
}
