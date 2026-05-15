export interface Bot {
  id: string;
  name: string;
  token: string;
  active: boolean;
  defaultEmoji: string;
  username?: string;
  createdAt: number;
}

export interface GlobalConfig {
  maxBotsPerMessage: number;
  delayMin: number;
  delayMax: number;
  emojiPool: string[];
  useRandomEmoji: boolean;
}

export const DEFAULT_CONFIG: GlobalConfig = {
  maxBotsPerMessage: 3,
  delayMin: 1000,
  delayMax: 5000,
  emojiPool: ['👍', '❤️', '🔥', '🥰', '👏', '😍', '🤩', '💯', '🎉', '✨'],
  useRandomEmoji: true,
};

// ── Scheduled Messages ────────────────────────────────────────────────────────

export interface ScheduledMessage {
  id: string;
  name: string;
  botId: string;
  chatId: string;          // Telegram chat ID or @username
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file';
  caption?: string;
  time: string;            // "HH:MM" 24 h in timezone
  days: number[];          // 0 = Sun … 6 = Sat
  timezone: string;        // e.g. "America/Sao_Paulo"
  active: boolean;
  lastFiredAt?: number;    // unix ms — used for dedup
  createdAt: number;
  updatedAt: number;
}

export type ScheduleLogEvent = 'sent' | 'error' | 'skipped';

export interface ScheduleLog {
  id: string;
  timestamp: number;
  scheduleId: string;
  scheduleName: string;
  botId: string;
  chatId: string;
  event: ScheduleLogEvent;
  error?: string;
}

// ── Reaction Logs ─────────────────────────────────────────────────────────────

export interface ReactionLog {
  id: string;
  timestamp: number;
  chatId: number | string;
  messageId: number;
  chatTitle: string;
  botId: string;
  botName: string;
  emoji: string;
  success: boolean;
  error?: string;
}
