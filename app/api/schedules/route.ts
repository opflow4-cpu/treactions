import { NextRequest, NextResponse } from 'next/server';
import { getSchedules, saveSchedules } from '@/lib/storage';
import { ScheduledMessage } from '@/lib/types';

export async function GET() {
  const schedules = await getSchedules();
  return NextResponse.json(schedules);
}

export async function POST(req: NextRequest) {
  let body: Partial<ScheduledMessage>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 }); }

  if (!body.name?.trim())   return NextResponse.json({ error: 'name é obrigatório' },   { status: 400 });
  if (!body.botId?.trim())  return NextResponse.json({ error: 'botId é obrigatório' },  { status: 400 });
  if (!body.chatId?.trim()) return NextResponse.json({ error: 'chatId é obrigatório' }, { status: 400 });
  if (!body.time?.match(/^\d{2}:\d{2}$/)) return NextResponse.json({ error: 'time deve ser HH:MM' }, { status: 400 });
  if (!Array.isArray(body.days) || body.days.length === 0)
    return NextResponse.json({ error: 'Selecione ao menos um dia' }, { status: 400 });

  const now = Date.now();
  const schedule: ScheduledMessage = {
    id:        `sch_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name:      body.name.trim(),
    botId:     body.botId.trim(),
    chatId:    body.chatId.trim(),
    message:   body.message?.trim() ?? '',
    mediaUrl:  body.mediaUrl?.trim() || undefined,
    mediaType: body.mediaType || undefined,
    caption:   body.caption?.trim() || undefined,
    time:      body.time,
    days:      body.days,
    timezone:  body.timezone?.trim() || 'America/Sao_Paulo',
    active:    body.active ?? true,
    createdAt: now,
    updatedAt: now,
  };

  const schedules = await getSchedules();
  schedules.push(schedule);
  await saveSchedules(schedules);

  return NextResponse.json(schedule, { status: 201 });
}
