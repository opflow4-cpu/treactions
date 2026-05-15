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
