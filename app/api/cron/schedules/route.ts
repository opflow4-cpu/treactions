import { NextRequest, NextResponse } from 'next/server';
import { getSchedules, saveSchedules, getBots, appendScheduleLog } from '@/lib/storage';
import { executeSchedule, getTimeInTz } from '@/lib/schedule-executor';

// Vercel cron fires this every minute.
// The Authorization header is sent automatically by Vercel when CRON_SECRET is set.

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const [schedules, bots] = await Promise.all([getSchedules(), getBots()]);
  const currentMinuteKey  = Math.floor(Date.now() / 60_000);

  const results: Array<{ id: string; name: string; status: 'sent' | 'skipped' | 'error'; reason?: string }> = [];
  const updatedSchedules  = [...schedules];

  for (let i = 0; i < updatedSchedules.length; i++) {
    const schedule = updatedSchedules[i];

    if (!schedule.active) {
      results.push({ id: schedule.id, name: schedule.name, status: 'skipped', reason: 'inactive' });
      continue;
    }

    // Dedup: already fired this exact minute?
    if (schedule.lastFiredAt) {
      const lastMinuteKey = Math.floor(schedule.lastFiredAt / 60_000);
      if (lastMinuteKey === currentMinuteKey) {
        results.push({ id: schedule.id, name: schedule.name, status: 'skipped', reason: 'already sent this minute' });
        await appendScheduleLog({
          id: `sl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
          timestamp: Date.now(),
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          botId: schedule.botId,
          chatId: schedule.chatId,
          event: 'skipped',
          error: 'already sent this minute',
        });
        continue;
      }
    }

    // Check time + day in schedule's timezone
    const { time, dayOfWeek } = getTimeInTz(schedule.timezone ?? 'America/Sao_Paulo');
    const timeMatch = time === schedule.time;
    const dayMatch  = schedule.days.includes(dayOfWeek);

    if (!timeMatch || !dayMatch) {
      results.push({ id: schedule.id, name: schedule.name, status: 'skipped', reason: `time=${time} day=${dayOfWeek}` });
      continue;
    }

    // Fire!
    const result = await executeSchedule(schedule, bots);

    if (result.ok) {
      // Stamp lastFiredAt so next invocation this minute is skipped
      updatedSchedules[i] = { ...schedule, lastFiredAt: Date.now() };
      results.push({ id: schedule.id, name: schedule.name, status: 'sent' });
    } else {
      results.push({ id: schedule.id, name: schedule.name, status: 'error', reason: result.error });
    }
  }

  // Persist updated lastFiredAt timestamps
  const anyUpdated = updatedSchedules.some((s, i) => s.lastFiredAt !== schedules[i]?.lastFiredAt);
  if (anyUpdated) {
    await saveSchedules(updatedSchedules);
  }

  console.log('[cron/schedules] results:', results);
  return NextResponse.json({ ok: true, checked: schedules.length, results });
}
