export type BlockType =
  | 'trigger'
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'buttons'
  | 'delay';

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

export interface ButtonOption {
  id: string;
  label: string;
  url: string;
}

export interface ButtonsBlock {
  id: string;
  type: 'buttons';
  text: string;
  buttons: ButtonOption[];
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
  buttons: {
    icon: '🔘',
    label: 'Botões',
    description: 'Mensagem com botões inline clicáveis',
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
    case 'buttons':  return {
      id, type: 'buttons', text: '',
      buttons: [{ id: `btn_${Date.now()}`, label: '', url: '' }],
    };
    case 'delay':    return { id, type: 'delay', seconds: 5 };
  }
}
