export interface OnboardingConfig {
  enabled: boolean;
  flowId: string;
  welcomeMessage: string;
  buttonText: string;
  fallbackEnabled: boolean;
  fallbackMessage: string;
}

export const DEFAULT_ONBOARDING: OnboardingConfig = {
  enabled: false,
  flowId: '',
  welcomeMessage: 'Olá! Seja bem-vindo(a)! Clique no botão abaixo para começar 👇',
  buttonText: '🚀 Começar agora',
  fallbackEnabled: true,
  fallbackMessage: 'Bem-vindo(a) ao grupo! Clique abaixo para receber sua mensagem de boas-vindas:',
};

export interface Bot {
  id: string;
  name: string;
  token: string;
  active: boolean;
  defaultEmoji: string;
  username?: string;
  createdAt: number;
  onboarding?: OnboardingConfig;
}

export type OnboardingEvent =
  | 'member_joined'
  | 'dm_sent'
  | 'dm_blocked'
  | 'start_received'
  | 'flow_started';

export interface OnboardingLog {
  id: string;
  timestamp: number;
  event: OnboardingEvent;
  botId: string;
  botName: string;
  userId: number;
  userName?: string;
  groupId?: number;
  groupTitle?: string;
  error?: string;
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
