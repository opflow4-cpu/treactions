export type BlockType =
  | 'trigger'
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'buttons'
  | 'delay';

// ── Button action system ──────────────────────────────────────────────────────

export type ButtonActionType =
  | 'url'
  | 'next_message'
  | 'custom_message'
  | 'send_media'
  | 'add_tag'
  | 'goto_flow'
  | 'dismiss';

export interface ButtonAction {
  type: ButtonActionType;
  url?: string;                                         // url
  message?: string;                                     // custom_message
  mediaUrl?: string;                                    // send_media
  mediaType?: 'image' | 'video' | 'audio' | 'file';   // send_media
  tag?: string;                                         // add_tag
  flowId?: string;                                      // goto_flow
}

export function defaultAction(): ButtonAction {
  return { type: 'url', url: '' };
}

/** Resolve action for a button — handles legacy buttons that only had `url` field */
export function resolveAction(btn: ButtonOption): ButtonAction {
  if (btn.action) return btn.action;
  if (btn.url) return { type: 'url', url: btn.url };
  return defaultAction();
}

export const ACTION_META: Record<ButtonActionType, { icon: string; label: string; color: string; hex: string }> = {
  url:            { icon: '🔗', label: 'URL',            color: 'text-blue-400',    hex: '#3b82f6' },
  next_message:   { icon: '→',  label: 'Próximo bloco',  color: 'text-indigo-400',  hex: '#6366f1' },
  custom_message: { icon: '💬', label: 'Mensagem',       color: 'text-emerald-400', hex: '#10b981' },
  send_media:     { icon: '📎', label: 'Mídia',          color: 'text-violet-400',  hex: '#8b5cf6' },
  add_tag:        { icon: '🏷', label: 'Adicionar tag',  color: 'text-amber-400',   hex: '#f59e0b' },
  goto_flow:      { icon: '↗',  label: 'Ir para fluxo',  color: 'text-pink-400',    hex: '#ec4899' },
  dismiss:        { icon: '✕',  label: 'Sumir',          color: 'text-gray-400',    hex: '#6b7280' },
};

// ── Individual block shapes ───────────────────────────────────────────────────

export interface TriggerBlock {
  id: string;
  type: 'trigger';
  keyword: string;
  matchType: 'exact' | 'contains' | 'starts';
}

export interface TextBlock {
  id: string;
  type: 'text';
  content: string;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  url: string;
  caption: string;
}

export interface VideoBlock {
  id: string;
  type: 'video';
  url: string;
  caption: string;
}

export interface AudioBlock {
  id: string;
  type: 'audio';
  url: string;
}

export interface DocumentBlock {
  id: string;
  type: 'document';
  url: string;
  caption: string;
}

export interface ButtonOption {
  id: string;
  label: string;
  url?: string;           // legacy field — kept for backward compat
  action: ButtonAction;   // new — use resolveAction() to read
}

export interface ButtonsBlock {
  id: string;
  type: 'buttons';
  text: string;
  buttons: ButtonOption[];
  /** buttonId → targetBlockId — populated from canvas edges */
  branching: { [buttonId: string]: string };
}

export interface DelayBlock {
  id: string;
  type: 'delay';
  seconds: number;
}

export type FlowBlock =
  | TriggerBlock
  | TextBlock
  | ImageBlock
  | VideoBlock
  | AudioBlock
  | DocumentBlock
  | ButtonsBlock
  | DelayBlock;

// ── Flow ─────────────────────────────────────────────────────────────────────

export interface Flow {
  id: string;
  name: string;
  active: boolean;
  botId: string;
  blocks: FlowBlock[];
  createdAt: number;
  updatedAt: number;
}

// ── Block metadata (for UI) ───────────────────────────────────────────────────

export const BLOCK_META: Record<
  BlockType,
  { icon: string; label: string; description: string; color: string }
> = {
  trigger: {
    icon: '⚡',
    label: 'Gatilho',
    description: 'Inicia o fluxo quando uma palavra-chave é enviada',
    color: 'text-yellow-400',
  },
  text: {
    icon: '📝',
    label: 'Texto',
    description: 'Envia uma mensagem de texto',
    color: 'text-blue-400',
  },
  image: {
    icon: '🖼️',
    label: 'Imagem',
    description: 'Envia uma imagem com legenda opcional',
    color: 'text-purple-400',
  },
  video: {
    icon: '🎬',
    label: 'Vídeo',
    description: 'Envia um vídeo com legenda opcional',
    color: 'text-pink-400',
  },
  audio: {
    icon: '🎵',
    label: 'Áudio',
    description: 'Envia um arquivo de áudio',
    color: 'text-orange-400',
  },
  document: {
    icon: '📎',
    label: 'Arquivo',
    description: 'Envia um documento ou arquivo',
    color: 'text-teal-400',
  },
  buttons: {
    icon: '🔘',
    label: 'Botões',
    description: 'Mensagem com botões de ação',
    color: 'text-emerald-400',
  },
  delay: {
    icon: '⏱️',
    label: 'Atraso',
    description: 'Aguarda N segundos antes do próximo bloco',
    color: 'text-gray-400',
  },
};

export function blockSummary(block: FlowBlock): string {
  switch (block.type) {
    case 'trigger':
      return block.keyword ? `"${block.keyword}" (${block.matchType})` : 'sem palavra-chave';
    case 'text':
      return block.content
        ? block.content.slice(0, 48) + (block.content.length > 48 ? '…' : '')
        : 'sem texto';
    case 'image':
    case 'video':
      return block.url ? block.url.slice(0, 48) + '…' : 'sem URL';
    case 'audio':
      return block.url ? block.url.slice(0, 48) + '…' : 'sem URL';
    case 'document':
      return block.url ? (block.caption || block.url.split('/').pop() || block.url.slice(0, 48)) : 'sem arquivo';
    case 'buttons':
      return `${block.buttons.length} botão(ões)${block.text ? ' — ' + block.text.slice(0, 30) : ''}`;
    case 'delay':
      return `${block.seconds}s de espera`;
  }
}

export function createBlock(type: BlockType): FlowBlock {
  const id = `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  switch (type) {
    case 'trigger':  return { id, type: 'trigger', keyword: '', matchType: 'contains' };
    case 'text':     return { id, type: 'text', content: '' };
    case 'image':    return { id, type: 'image', url: '', caption: '' };
    case 'video':    return { id, type: 'video', url: '', caption: '' };
    case 'audio':    return { id, type: 'audio', url: '' };
    case 'document': return { id, type: 'document', url: '', caption: '' };
    case 'buttons':  return {
      id, type: 'buttons', text: '',
      buttons: [{ id: `btn_${Date.now()}`, label: '', action: { type: 'url', url: '' } }],
      branching: {},
    };
    case 'delay':    return { id, type: 'delay', seconds: 5 };
  }
}
