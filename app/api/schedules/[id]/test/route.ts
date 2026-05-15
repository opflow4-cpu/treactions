import { NextRequest, NextResponse } from 'next/server';
import { getSchedules, getBots } from '@/lib/storage';
import { executeSchedule } from '@/lib/schedule-executor';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const [schedules, bots] = await Promise.all([getSchedules(), getBots()]);
  const schedule = schedules.find((s) => s.id === id);
  if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const result = await executeSchedule(schedule, bots);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
