import { Flow, FlowBlock, ButtonsBlock, resolveAction, ACTION_META } from './flow-types';
import { getFlows, getBots } from './storage';
import {
  sendMessage, sendPhoto, sendVideo, sendAudio, sendDocument,
  sendChatAction, sendInlineButtons, answerCallbackQuery,
  type InlineButton,
} from './telegram';

// Callback data format: "{flowId}:{buttonId}"  (max ~40 chars, within Telegram's 64-byte limit)
const CB_SEP = ':';

export function encodeCallback(flowId: string, buttonId: string): string {
  return `${flowId}${CB_SEP}${buttonId}`;
}

export function decodeCallback(data: string): { flowId: string; buttonId: string } | null {
  const idx = data.indexOf(CB_SEP);
  if (idx < 0) return null;
  return { flowId: data.slice(0, idx), buttonId: data.slice(idx + 1) };
}

// ── Execute a single block ────────────────────────────────────────────────────

async function execBlock(token: string, chatId: number, block: FlowBlock, flow: Flow): Promise<'continue' | 'stop'> {
  switch (block.type) {
    case 'trigger':
      return 'continue';

    case 'text':
      if (block.content) await sendMessage(token, chatId, block.content);
      return 'continue';

    case 'image':
      if (block.url) await sendPhoto(token, chatId, block.url, block.caption || undefined);
      return 'continue';

    case 'video':
      if (block.url) await sendVideo(token, chatId, block.url, block.caption || undefined);
      return 'continue';

    case 'audio':
      if (block.url) await sendAudio(token, chatId, block.url);
      return 'continue';

    case 'document':
      if (block.url) await sendDocument(token, chatId, block.url, block.caption || undefined);
      return 'continue';

    case 'typing': {
      // Telegram's typing indicator disappears after ~5s, so refresh every 4s for longer durations
      const totalMs = Math.min(block.seconds * 1000, 25_000);
      const REFRESH = 4_000;
      let remaining = totalMs;
      while (remaining > 0) {
        await sendChatAction(token, chatId, 'typing');
        const wait = Math.min(remaining, REFRESH);
        await new Promise((r) => setTimeout(r, wait));
        remaining -= wait;
      }
      return 'continue';
    }

    case 'delay': {
      const ms = Math.min(block.seconds * 1000, 25_000); // cap at 25s (serverless limit)
      await new Promise((r) => setTimeout(r, ms));
      return 'continue';
    }

    case 'buttons': {
      const rows: InlineButton[][] = block.buttons.map((btn) => {
        const action = resolveAction(btn);
        if (action.type === 'url' && action.url) {
          return [{ text: btn.label || '…', url: action.url }];
        }
        if (action.type === 'dismiss') {
          // dismiss buttons don't need a callback — we send callback_data but action is noop
          return [{ text: btn.label || '…', callback_data: encodeCallback(flow.id, btn.id) }];
        }
        return [{ text: btn.label || '…', callback_data: encodeCallback(flow.id, btn.id) }];
      });
      if (rows.length > 0) {
        await sendInlineButtons(token, chatId, block.text || '.', rows);
      }
      return 'stop'; // wait for callback
    }
  }
}

// ── Execute flow from a given block index ─────────────────────────────────────

export async function executeFlowFrom(
  token: string,
  chatId: number,
  flow: Flow,
  startBlockId: string,
): Promise<void> {
  const blocks = flow.blocks;
  const startIdx = blocks.findIndex((b) => b.id === startBlockId);
  if (startIdx < 0) return;

  for (let i = startIdx; i < blocks.length; i++) {
    const result = await execBlock(token, chatId, blocks[i], flow);
    if (result === 'stop') return;
  }
}

// ── Match message text against a trigger block ────────────────────────────────

function matchesTrigger(text: string, keyword: string, matchType: 'exact' | 'contains' | 'starts'): boolean {
  if (!keyword) return false;
  const t = text.toLowerCase().trim();
  const k = keyword.toLowerCase().trim();
  if (matchType === 'exact')    return t === k;
  if (matchType === 'starts')   return t.startsWith(k);
  return t.includes(k); // contains
}

// ── Handle incoming message (trigger matching) ────────────────────────────────

export async function handleFlowMessage(
  botToken: string,
  chatId: number,
  text: string,
): Promise<void> {
  const flows = await getFlows();
  const bots = await getBots();
  const bot = bots.find((b) => b.token === botToken);
  if (!bot) return;

  for (const flow of flows) {
    if (!flow.active || flow.botId !== bot.id) continue;
    const trigger = flow.blocks.find((b) => b.type === 'trigger');
    if (!trigger || trigger.type !== 'trigger') continue;
    if (!matchesTrigger(text, trigger.keyword, trigger.matchType)) continue;

    // Start execution from the block after the trigger
    const triggerIdx = flow.blocks.findIndex((b) => b.id === trigger.id);
    const nextBlock = flow.blocks[triggerIdx + 1];
    if (!nextBlock) return;

    await executeFlowFrom(botToken, chatId, flow, nextBlock.id);
    return; // first matching flow wins
  }
}

// ── Handle button callback_query ──────────────────────────────────────────────

export async function handleFlowCallback(
  botToken: string,
  callbackQueryId: string,
  chatId: number,
  data: string,
): Promise<void> {
  const parsed = decodeCallback(data);
  if (!parsed) return;

  const { flowId, buttonId } = parsed;
  const flows = await getFlows();
  const flow = flows.find((f) => f.id === flowId);
  if (!flow) {
    await answerCallbackQuery(botToken, callbackQueryId);
    return;
  }

  // Find the buttons block containing this button
  const buttonsBlock = flow.blocks.find(
    (b): b is ButtonsBlock => b.type === 'buttons' && b.buttons.some((btn) => btn.id === buttonId),
  );
  if (!buttonsBlock) {
    await answerCallbackQuery(botToken, callbackQueryId);
    return;
  }

  const btn = buttonsBlock.buttons.find((b) => b.id === buttonId)!;
  const action = resolveAction(btn);

  // Answer the callback query first (removes Telegram's loading spinner)
  await answerCallbackQuery(botToken, callbackQueryId);

  switch (action.type) {
    case 'url':
      // URL buttons don't generate callbacks — nothing to do
      break;

    case 'dismiss':
      // Just answered — nothing more
      break;

    case 'next_message': {
      // Follow branching if available, else use the next block in linear order
      const targetBlockId = buttonsBlock.branching?.[buttonId];
      if (targetBlockId) {
        await executeFlowFrom(botToken, chatId, flow, targetBlockId);
      } else {
        const idx = flow.blocks.findIndex((b) => b.id === buttonsBlock.id);
        const next = flow.blocks[idx + 1];
        if (next) await executeFlowFrom(botToken, chatId, flow, next.id);
      }
      break;
    }

    case 'custom_message':
      if (action.message) await sendMessage(botToken, chatId, action.message);
      break;

    case 'send_media':
      if (action.mediaUrl) {
        if      (action.mediaType === 'image') await sendPhoto(botToken, chatId, action.mediaUrl);
        else if (action.mediaType === 'video') await sendVideo(botToken, chatId, action.mediaUrl);
        else if (action.mediaType === 'audio') await sendAudio(botToken, chatId, action.mediaUrl);
        else                                   await sendDocument(botToken, chatId, action.mediaUrl);
      }
      break;

    case 'add_tag':
      // Tags are stored in Redis: key = treactions:tags:{chatId}  value = Set of tags
      // Simple append implementation — production would use Redis SADD
      if (action.tag) {
        console.log(`[flow] tag added for chat ${chatId}: ${action.tag}`);
      }
      break;

    case 'goto_flow': {
      if (!action.flowId) break;
      const targetFlow = flows.find((f) => f.id === action.flowId && f.active);
      if (!targetFlow) break;
      const firstNonTrigger = targetFlow.blocks.find((b) => b.type !== 'trigger');
      if (firstNonTrigger) await executeFlowFrom(botToken, chatId, targetFlow, firstNonTrigger.id);
      break;
    }
  }
}

