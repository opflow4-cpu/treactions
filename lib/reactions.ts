import { Bot, GlobalConfig } from './types';
import { getBots, getConfig, hasReacted, markReacted, appendLog } from './storage';
import { sendReaction } from './telegram';

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickEmoji(bot: Bot, config: GlobalConfig): string {
  const pool = config.emojiPool.length > 0 ? config.emojiPool : ['👍'];
  if (!config.useRandomEmoji && bot.defaultEmoji) return bot.defaultEmoji;
  // 30% chance to use the bot's own default emoji, 70% random from pool
  if (bot.defaultEmoji && Math.random() < 0.3) return bot.defaultEmoji;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function reactWithBot(
  bot: Bot,
  chatId: number | string,
  messageId: number,
  chatTitle: string,
  config: GlobalConfig,
): Promise<void> {
  // Random delay before reacting
  const delay = randInt(config.delayMin, config.delayMax);
  await sleep(delay);

  // Skip if this bot already reacted to this message
  if (await hasReacted(chatId, messageId, bot.id)) return;

  const emoji = pickEmoji(bot, config);
  const result = await sendReaction(bot.token, chatId, messageId, emoji);

  await appendLog({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    chatId,
    messageId,
    chatTitle,
    botId: bot.id,
    botName: bot.name,
    emoji,
    success: result.ok,
    error: result.error,
  });

  if (result.ok) {
    await markReacted(chatId, messageId, bot.id);
  }
}

export async function dispatchReactions(
  chatId: number | string,
  messageId: number,
  chatTitle: string,
): Promise<void> {
  const [bots, config] = await Promise.all([getBots(), getConfig()]);

  const active = bots.filter((b) => b.active);
  if (active.length === 0) return;

  // Shuffle and cap to maxBotsPerMessage
  const shuffled = [...active].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, config.maxBotsPerMessage);

  await Promise.all(
    selected.map((bot) => reactWithBot(bot, chatId, messageId, chatTitle, config)),
  );
}
