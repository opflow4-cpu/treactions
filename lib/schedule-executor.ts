import { ScheduledMessage, ScheduleLog, Bot } from './types';
import { appendScheduleLog } from './storage';
import {
  sendMessage, sendPhoto, sendVideo, sendAudio, sendDocument,
} from './telegram';

// ── Log helper ────────────────────────────────────────────────────────────────

function newId(): string {
  return `sl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

async function log(entry: Omit<ScheduleLog, 'id' | 'timestamp'>): Promise<void> {
  await appendScheduleLog({ id: newId(), timestamp: Date.now(), ...entry });
}

// ── Timezone helpers ──────────────────────────────────────────────────────────

export function getTimeInTz(timezone: string): { time: string; dayOfWeek: number } {
  const now = new Date();

  // Hour + minute
  const tp = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hour   = tp.find((p) => p.type === 'hour')?.value   ?? '00';
  const minute = tp.find((p) => p.type === 'minute')?.value ?? '00';
  // Intl can return '24' for midnight — normalise
  const h = Number(hour) % 24;
  const time = `${String(h).padStart(2, '0')}:${minute}`;

  // Day of week in that timezone
  const weekdayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  }).format(now);

  const DAY_MAP: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  const dayOfWeek = DAY_MAP[weekdayStr] ?? 0;

  return { time, dayOfWeek };
}

// ── Core send ─────────────────────────────────────────────────────────────────

export async function executeSchedule(
  schedule: ScheduledMessage,
  bots: Bot[],
): Promise<{ ok: boolean; error?: string }> {
  const bot = bots.find((b) => b.id === schedule.botId);
  if (!bot) return { ok: false, error: 'Bot não encontrado' };
  if (!bot.active) return { ok: false, error: 'Bot inativo' };

  const { token } = bot;
  const { chatId, message, mediaUrl, mediaType, caption } = schedule;

  let result: { ok: boolean; error?: string };

  if (mediaUrl && mediaType) {
    const cap = caption || message || undefined;
    switch (mediaType) {
      case 'image':  result = await sendPhoto(token, chatId, mediaUrl, cap);    break;
      case 'video':  result = await sendVideo(token, chatId, mediaUrl, cap);    break;
      case 'audio':  result = await sendAudio(token, chatId, mediaUrl);         break;
      case 'file':   result = await sendDocument(token, chatId, mediaUrl, cap); break;
      default:       result = { ok: false, error: 'Tipo de mídia inválido' };
    }
    // If media sent and there's also a text body, send it separately
    if (result.ok && message && mediaType === 'audio') {
      await sendMessage(token, chatId, message);
    }
  } else if (message) {
    result = await sendMessage(token, chatId, message);
  } else {
    result = { ok: false, error: 'Agendamento sem mensagem nem mídia' };
  }

  // Log result
  await log({
    scheduleId:   schedule.id,
    scheduleName: schedule.name,
    botId:        schedule.botId,
    chatId,
    event:        result.ok ? 'sent' : 'error',
    error:        result.ok ? undefined : result.error,
  });

  return result;
}
