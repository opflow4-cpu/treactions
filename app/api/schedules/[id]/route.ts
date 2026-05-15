import { NextRequest, NextResponse } from 'next/server';
import { getSchedules, saveSchedules } from '@/lib/storage';
import { ScheduledMessage } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const schedules = await getSchedules();
  const s = schedules.find((s) => s.id === id);
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(s);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const schedules = await getSchedules();
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Partial<ScheduledMessage>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 }); }

  const updated: ScheduledMessage = {
    ...schedules[idx],
    ...body,
    id,                           // never overwrite id
    updatedAt: Date.now(),
  };
  schedules[idx] = updated;
  await saveSchedules(schedules);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const schedules = await getSchedules();
  const filtered = schedules.filter((s) => s.id !== id);
  if (filtered.length === schedules.length)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await saveSchedules(filtered);
  return NextResponse.json({ ok: true });
}
