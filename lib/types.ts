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
  // ✨ removido — causa REACTION_INVALID no Telegram
  emojiPool: ['👍', '❤️', '🔥', '👏', '😍', '🎉', '🤩', '💯'],
  useRandomEmoji: true,
};

// ── Bot Chats ─────────────────────────────────────────────────────────────────

export type BotRole = 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked' | 'unknown';
export type ChatKind = 'group' | 'supergroup' | 'channel' | 'private';

export interface BotChat {
  chatId:        number | string;
  title:         string;
  type:          ChatKind;
  username?:     string;
  botRole:       BotRole;
  memberCount?:  number;
  lastSeen:      number;   // último update recebido via webhook
  lastChecked?:  number;   // última vez que chamamos a Telegram API
  error?:        string;   // "Bot sem acesso ao chat ou chat inválido" etc
}

// ── Member Events ─────────────────────────────────────────────────────────────

export type MemberEventType = 'joined' | 'left';

export interface MemberEvent {
  id: string;
  timestamp: number;
  chatId: number | string;
  chatTitle: string;
  userId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  event: MemberEventType;
  botId: string;
  botName: string;
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
