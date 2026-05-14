import { Bot, GlobalConfig, DEFAULT_CONFIG, ReactionLog } from './types';

const REACTION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_LOGS = 500;

// ── Storage backends ──────────────────────────────────────────────────────────

interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, exSeconds?: number): Promise<void>;
}

// Upstash Redis via HTTP REST API (no native deps)
class UpstashKV implements KV {
  constructor(private url: string, private token: string) {}

  async get<T>(key: string): Promise<T | null> {
    const res = await fetch(`${this.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: 'no-store',
    });
    const json = (await res.json()) as { result: string | null };
    if (json.result === null || json.result === undefined) return null;
    try {
      return JSON.parse(json.result) as T;
    } catch {
      return json.result as unknown as T;
    }
  }

  async set<T>(key: string, value: T, exSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    const parts = [encodeURIComponent(key), encodeURIComponent(serialized)];
    if (exSeconds) parts.push('ex', String(exSeconds));
    await fetch(`${this.url}/set/${parts.join('/')}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
    });
  }
}

// JSON file storage for local development
class FileKV implements KV {
  private data: Record<string, { value: unknown; exAt?: number }> = {};
  private filePath = '.treactions-data.json';
  private loaded = false;

  private async load() {
    if (this.loaded) return;
    try {
      const { readFileSync } = await import('fs');
      this.data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
    } catch {
      this.data = {};
    }
    this.loaded = true;
  }

  private async persist() {
    const { writeFileSync } = await import('fs');
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  async get<T>(key: string): Promise<T | null> {
    await this.load();
    const entry = this.data[key];
    if (!entry) return null;
    if (entry.exAt && Date.now() > entry.exAt) {
      delete this.data[key];
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, exSeconds?: number): Promise<void> {
    await this.load();
    this.data[key] = {
      value,
      exAt: exSeconds ? Date.now() + exSeconds * 1000 : undefined,
    };
    await this.persist();
  }
}

function createKV(): KV {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashKV(url, token);
  return new FileKV();
}

// Singleton – reused across hot-reloads in dev
const globalKV = global as typeof global & { __treactions_kv?: KV };
if (!globalKV.__treactions_kv) globalKV.__treactions_kv = createKV();
const kv = globalKV.__treactions_kv;

// ── Public API ────────────────────────────────────────────────────────────────

export async function getBots(): Promise<Bot[]> {
  return (await kv.get<Bot[]>('tr:bots')) ?? [];
}

export async function saveBots(bots: Bot[]): Promise<void> {
  await kv.set('tr:bots', bots);
}

export async function getConfig(): Promise<GlobalConfig> {
  return (await kv.get<GlobalConfig>('tr:config')) ?? { ...DEFAULT_CONFIG };
}

export async function saveConfig(config: GlobalConfig): Promise<void> {
  await kv.set('tr:config', config);
}

export async function getLogs(): Promise<ReactionLog[]> {
  return (await kv.get<ReactionLog[]>('tr:logs')) ?? [];
}

export async function appendLog(log: ReactionLog): Promise<void> {
  const logs = await getLogs();
  logs.unshift(log);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  await kv.set('tr:logs', logs);
}

export async function clearLogs(): Promise<void> {
  await kv.set('tr:logs', []);
}

export async function hasReacted(
  chatId: number | string,
  messageId: number,
  botId: string,
): Promise<boolean> {
  const key = `tr:rx:${chatId}:${messageId}:${botId}`;
  return (await kv.get<boolean>(key)) === true;
}

export async function markReacted(
  chatId: number | string,
  messageId: number,
  botId: string,
): Promise<void> {
  const key = `tr:rx:${chatId}:${messageId}:${botId}`;
  await kv.set(key, true, Math.floor(REACTION_TTL_MS / 1000));
}
