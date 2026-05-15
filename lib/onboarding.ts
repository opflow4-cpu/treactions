import { Bot, OnboardingLog } from './types';
import { getFlows, appendOnboardingLog } from './storage';
import { sendInlineButtons } from './telegram';
import { executeFlowFrom } from './flow-executor';

// ── Helpers ───────────────────────────────────────────────────────────────────

function newLogId(): string {
  return `ob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function log(entry: Omit<OnboardingLog, 'id' | 'timestamp'>): Promise<void> {
  return appendOnboardingLog({ id: newLogId(), timestamp: Date.now(), ...entry });
}

// ── Handle new_chat_members ───────────────────────────────────────────────────
//
// Called when a non-bot user joins a group where the bot is present.
// Tries to DM the user; falls back to a group message if blocked.

export async function handleNewMember(
  token: string,
  bot: Bot,
  userId: number,
  userName: string | undefined,
  groupId: number,
  groupTitle: string,
): Promise<void> {
  const cfg = bot.onboarding;
  if (!cfg?.enabled) return;

  // Log the join event
  await log({
    event: 'member_joined',
    botId: bot.id, botName: bot.name,
    userId, userName, groupId, groupTitle,
  });

  if (!bot.username) {
    console.warn('[onboarding] bot.username missing — cannot build deep link for bot', bot.id);
    return;
  }

  // Build Telegram deep link: t.me/BOT_USERNAME?start=welcome_USERID_GROUPID
  const startPayload = `welcome_${userId}_${groupId}`;
  const deepLink     = `https://t.me/${bot.username}?start=${startPayload}`;

  const buttonText = cfg.buttonText?.trim() || '🚀 Começar agora';
  const message    = cfg.welcomeMessage?.trim() || 'Olá! Bem-vindo(a)! Clique abaixo para começar 👇';
  const rows       = [[{ text: buttonText, url: deepLink }]];

  // ── Try sending DM ────────────────────────────────────────────────────────
  const dmResult = await sendInlineButtons(token, userId, message, rows);

  if (dmResult.ok) {
    await log({
      event: 'dm_sent',
      botId: bot.id, botName: bot.name,
      userId, userName, groupId, groupTitle,
    });
    return;
  }

  // DM failed (user never started the bot / privacy settings)
  await log({
    event: 'dm_blocked',
    botId: bot.id, botName: bot.name,
    userId, userName, groupId, groupTitle,
    error: dmResult.error,
  });

  // ── Fallback: send in group ───────────────────────────────────────────────
  if (cfg.fallbackEnabled) {
    const fbMessage = cfg.fallbackMessage?.trim() ||
      'Bem-vindo(a)! Clique abaixo para receber sua mensagem de boas-vindas:';
    await sendInlineButtons(token, groupId, fbMessage, rows);
  }
}

// ── Handle /start welcome_USERID_GROUPID ─────────────────────────────────────
//
// Called when the user clicks the deep-link button and opens the bot.

export async function handleWelcomeStart(
  token: string,
  bot: Bot,
  fromUserId: number,
  fromUserName: string | undefined,
  rawPayload: string,
): Promise<void> {
  // payload: welcome_{userId}_{groupId}
  const inner = rawPayload.slice('welcome_'.length); // "USERID_GROUPID"
  const lastUnderscore = inner.lastIndexOf('_');
  const groupId = lastUnderscore >= 0 ? Number(inner.slice(lastUnderscore + 1)) : undefined;

  await log({
    event: 'start_received',
    botId: bot.id, botName: bot.name,
    userId: fromUserId, userName: fromUserName,
    groupId,
  });

  const cfg = bot.onboarding;
  if (!cfg?.enabled || !cfg.flowId) return;

  const flows = await getFlows();
  const flow  = flows.find((f) => f.id === cfg.flowId && f.active);
  if (!flow) {
    console.warn('[onboarding] flow not found or inactive:', cfg.flowId);
    return;
  }

  // Start from the first non-trigger block
  const firstBlock = flow.blocks.find((b) => b.type !== 'trigger');
  if (!firstBlock) return;

  await log({
    event: 'flow_started',
    botId: bot.id, botName: bot.name,
    userId: fromUserId, userName: fromUserName,
    groupId,
  });

  await executeFlowFrom(token, fromUserId, flow, firstBlock.id);
}
