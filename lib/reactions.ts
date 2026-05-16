import { Bot, GlobalConfig } from './types';
import { getBots, getConfig, hasReacted, markReacted, appendLog } from './storage';
import { sendReaction } from './telegram';

// ── Emojis validados pela API do Telegram (setMessageReaction) ────────────────
// Fonte: https://core.telegram.org/bots/api#reactiontypeemoji
// Qualquer outro emoji retorna REACTION_INVALID.
export const SAFE_EMOJIS = ['👍', '❤️', '🔥', '👏', '😍', '🎉', '🤩', '💯'] as const;

// Emoji de fallback primário e secundário usados no retry automático
const FALLBACK_PRIMARY   = '🔥';
const FALLBACK_SECONDARY = '👍';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Garante que o emoji está na whitelist.
 * Se não estiver, retorna o FALLBACK_PRIMARY.
 */
function sanitizeEmoji(emoji: string): string {
  return (SAFE_EMOJIS as readonly string[]).includes(emoji) ? emoji : FALLBACK_PRIMARY;
}

function pickEmoji(bot: Bot, config: GlobalConfig): string {
  // Filtra o pool pelo whitelist — remove qualquer emoji inválido salvo na config
  const safePool = config.emojiPool.filter((e) =>
    (SAFE_EMOJIS as readonly string[]).includes(e),
  );
  const pool = safePool.length > 0 ? safePool : [FALLBACK_PRIMARY];

  if (!config.useRandomEmoji && bot.defaultEmoji) {
    return sanitizeEmoji(bot.defaultEmoji);
  }
  // 30% chance de usar o emoji padrão do bot, 70% aleatório do pool
  if (bot.defaultEmoji && Math.random() < 0.3) {
    return sanitizeEmoji(bot.defaultEmoji);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Classifica o tipo de erro retornado pelo Telegram ────────────────────────

type TGErrorKind =
  | 'reaction_invalid'  // REACTION_INVALID — emoji não suportado
  | 'chat_not_found'    // chat not found / bot sem acesso
  | 'message_not_found' // mensagem não existe mais
  | 'other';

function classifyError(description = ''): TGErrorKind {
  const d = description.toLowerCase();
  if (d.includes('reaction_invalid'))  return 'reaction_invalid';
  if (d.includes('chat not found') || d.includes('bot was kicked') || d.includes('forbidden'))
    return 'chat_not_found';
  if (d.includes('message to react not found') || d.includes('message not found'))
    return 'message_not_found';
  return 'other';
}

// ── Reação individual por bot ─────────────────────────────────────────────────

async function reactWithBot(
  bot: Bot,
  chatId: number | string,
  messageId: number,
  chatTitle: string,
  config: GlobalConfig,
): Promise<void> {
  try {
    // Delay aleatório antes de reagir (simula comportamento humano)
    const delay = randInt(config.delayMin, config.delayMax);
    await sleep(delay);

    // Skip se este bot já reagiu a esta mensagem
    if (await hasReacted(chatId, messageId, bot.id)) return;

    const emoji = pickEmoji(bot, config);

    // ── Primeira tentativa ────────────────────────────────────────────────────
    let result = await sendReaction(bot.token, chatId, messageId, emoji);

    // ── Retry automático em caso de REACTION_INVALID ──────────────────────────
    if (!result.ok && classifyError(result.error) === 'reaction_invalid') {
      // Escolhe um fallback diferente do emoji que falhou
      const fallback = emoji !== FALLBACK_PRIMARY ? FALLBACK_PRIMARY : FALLBACK_SECONDARY;

      console.warn(
        `[reactions] REACTION_INVALID bot="${bot.name}" emoji="${emoji}" → retentando com "${fallback}"`,
      );

      result = await sendReaction(bot.token, chatId, messageId, fallback);

      // Loga a tentativa falha original
      await appendLog({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        chatId,
        messageId,
        chatTitle,
        botId:   bot.id,
        botName: bot.name,
        emoji,
        success: false,
        error: `REACTION_INVALID — retentou com ${fallback}`,
      });

      // Usa o emoji do retry para o log final
      if (result.ok) {
        await appendLog({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          chatId,
          messageId,
          chatTitle,
          botId:   bot.id,
          botName: bot.name,
          emoji:   fallback,
          success: true,
        });
        await markReacted(chatId, messageId, bot.id);
        return;
      }
    }

    // ── Trata "chat not found" com mensagem amigável ──────────────────────────
    if (!result.ok && classifyError(result.error) === 'chat_not_found') {
      const friendlyError = 'Bot sem acesso ao chat ou chat inválido';
      console.warn(
        `[reactions] chat_not_found bot="${bot.name}" chat="${chatTitle}" (${chatId})`,
      );
      await appendLog({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        chatId,
        messageId,
        chatTitle,
        botId:   bot.id,
        botName: bot.name,
        emoji,
        success: false,
        error: friendlyError,
      });
      return; // não propaga o erro — outros bots continuam
    }

    // ── Log padrão (sucesso ou outro erro) ────────────────────────────────────
    const logError = result.ok
      ? undefined
      : (result.error ?? 'Erro desconhecido');

    await appendLog({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      chatId,
      messageId,
      chatTitle,
      botId:   bot.id,
      botName: bot.name,
      emoji,
      success: result.ok,
      error:   logError,
    });

    if (result.ok) {
      await markReacted(chatId, messageId, bot.id);
    } else {
      console.warn(
        `[reactions] erro bot="${bot.name}" chat="${chatTitle}" emoji="${emoji}": ${result.error}`,
      );
    }
  } catch (err) {
    // Isola falhas inesperadas — um bot com erro não para os outros
    console.error(`[reactions] exceção bot="${bot.name}" chat="${chatTitle}":`, err);
    await appendLog({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      chatId,
      messageId,
      chatTitle,
      botId:   bot.id,
      botName: bot.name,
      emoji:   '?',
      success: false,
      error:   String(err),
    }).catch(() => {}); // não falha se o log também falhar
  }
}

// ── Dispatcher principal ──────────────────────────────────────────────────────

export async function dispatchReactions(
  chatId: number | string,
  messageId: number,
  chatTitle: string,
): Promise<void> {
  const [bots, config] = await Promise.all([getBots(), getConfig()]);

  const active = bots.filter((b) => b.active);
  if (active.length === 0) return;

  // Shuffle e limita ao máximo configurado
  const shuffled = [...active].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, config.maxBotsPerMessage);

  // allSettled garante que a falha de um bot não cancela os outros
  await Promise.allSettled(
    selected.map((bot) => reactWithBot(bot, chatId, messageId, chatTitle, config)),
  );
}
