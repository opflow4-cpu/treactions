import { Bot, GlobalConfig, DEFAULT_CONFIG, ReactionLog } from './types';

const REACTION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_LOGS = 500;
const BOTS_KEY = 'treactions:bots';
const CONFIG_KEY = 'treactions:config';
const LOGS_KEY = 'treactions:logs';

// ── Storage backends ──────────────────────────────────────────────────────────

interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, exSeconds?: number): Promise<void>;
}

// ── Upstash Redis (production) ────────────────────────────────────────────────
// Uses the body-based command format: POST / with body ["COMMAND", ...args]
// This avoids URL-length limits that break the path-based format for large values.
class UpstashKV implements KV {
  constructor(private url: string, private token: string) {}

  private async cmd(command: (string | number)[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
    });

    let data: { result?: unknown; error?: string };
    try {
      data = await res.json();
    } catch {
      throw new Error(`Upstash: invalid JSON response (HTTP ${res.status})`);
    }

    if (!res.ok || data.error) {
      throw new Error(`Upstash error: ${data.error ?? res.statusText}`);
    }

    return data.result;
  }

  async get<T>(key: string): Promise<T | null> {
    const result = await this.cmd(['GET', key]);
    if (result === null || result === undefined) return null;
    // Upstash returns stored string; we always store JSON.stringify'd values
    try {
      return JSON.parse(result as string) as T;
    } catch {
      return result as T;
    }
  }

  async set<T>(key: string, value: T, exSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    const cmd: (string | number)[] = ['SET', key, serialized];
    if (exSeconds) cmd.push('EX', exSeconds);
    await this.cmd(cmd); // throws if Upstash rejects
  }
}

// ── File-based storage (local development) ────────────────────────────────────
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

// ── Singleton ─────────────────────────────────────────────────────────────────
function createKV(): KV {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    console.log('[storage] using Upstash Redis at', url.slice(0, 40) + '…');
    return new UpstashKV(url, token);
  }
  console.log('[storage] no KV env vars found — using local file storage');
  return new FileKV();
}

const globalKV = global as typeof global & { __treactions_kv?: KV };
if (!globalKV.__treactions_kv) globalKV.__treactions_kv = createKV();
const kv = globalKV.__treactions_kv;

// ── Public API ────────────────────────────────────────────────────────────────

export async function getBots(): Promise<Bot[]> {
  const bots = (await kv.get<Bot[]>(BOTS_KEY)) ?? [];
  console.log(`[storage] getBots → ${bots.length} bots`);
  return bots;
}

export async function saveBots(bots: Bot[]): Promise<void> {
  console.log(`[storage] saveBots → saving ${bots.length} bots with key "${BOTS_KEY}"`);
  await kv.set(BOTS_KEY, bots); // throws on failure — callers must handle
  console.log(`[storage] saveBots → done`);
}

export async function getConfig(): Promise<GlobalConfig> {
  return (await kv.get<GlobalConfig>(CONFIG_KEY)) ?? { ...DEFAULT_CONFIG };
}

export async function saveConfig(config: GlobalConfig): Promise<void> {
  await kv.set(CONFIG_KEY, config);
}

export async function getLogs(): Promise<ReactionLog[]> {
  return (await kv.get<ReactionLog[]>(LOGS_KEY)) ?? [];
}

export async function appendLog(log: ReactionLog): Promise<void> {
  const logs = await getLogs();
  logs.unshift(log);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  await kv.set(LOGS_KEY, logs);
}

export async function clearLogs(): Promise<void> {
  await kv.set(LOGS_KEY, []);
}

export async function hasReacted(
  chatId: number | string,
  messageId: number,
  botId: string,
): Promise<boolean> {
  const key = `treactions:rx:${chatId}:${messageId}:${botId}`;
  return (await kv.get<boolean>(key)) === true;
}

export async function markReacted(
  chatId: number | string,
  messageId: number,
  botId: string,
): Promise<void> {
  const key = `treactions:rx:${chatId}:${messageId}:${botId}`;
  await kv.set(key, true, Math.floor(REACTION_TTL_MS / 1000));
}
