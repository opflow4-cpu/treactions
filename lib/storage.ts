import { Bot, GlobalConfig, DEFAULT_CONFIG, ReactionLog } from './types';
import { Flow } from './flow-types';

const REACTION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_LOGS = 500;
const BOTS_KEY   = 'treactions:bots';
const CONFIG_KEY = 'treactions:config';
const LOGS_KEY   = 'treactions:logs';
const FLOWS_KEY  = 'treactions:flows';

// ── Storage interface ─────────────────────────────────────────────────────────

interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, exSeconds?: number): Promise<void>;
}

// ── Upstash Redis (production) ────────────────────────────────────────────────
//
// Uses the /pipeline endpoint: POST {url}/pipeline with body [["CMD", ...args]]
// This is universally supported across all Upstash plans and Vercel KV.
// The plain POST / format only works on some configurations.
//
class UpstashKV implements KV {
  private pipelineUrl: string;

  constructor(private url: string, private token: string) {
    const base = url.replace(/\/+$/, '');
    this.pipelineUrl = `${base}/pipeline`;
  }

  private async pipeline(
    commands: (string | number)[][],
  ): Promise<Array<{ result: unknown; error?: string }>> {
    let res: Response;
    try {
      res = await fetch(this.pipelineUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commands),
        cache: 'no-store',
      });
    } catch (fetchErr) {
      throw new Error(`Upstash fetch failed: ${String(fetchErr)}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Upstash HTTP ${res.status}: ${text}`);
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new Error('Upstash: response is not valid JSON');
    }

    if (!Array.isArray(data)) {
      throw new Error(`Upstash: expected array response, got: ${JSON.stringify(data)}`);
    }

    return data as Array<{ result: unknown; error?: string }>;
  }

  async get<T>(key: string): Promise<T | null> {
    const results = await this.pipeline([['GET', key]]);
    const item = results[0];

    if (item.error) {
      throw new Error(`Upstash GET "${key}" error: ${item.error}`);
    }

    const raw = item.result;

    // Key does not exist
    if (raw === null || raw === undefined) return null;

    // Already a non-string (some SDKs / proxy layers auto-parse JSON)
    if (typeof raw !== 'string') return raw as T;

    // Stored as JSON string — parse it
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Not valid JSON — return as-is
      return raw as unknown as T;
    }
  }

  async set<T>(key: string, value: T, exSeconds?: number): Promise<void> {
    const cmd: (string | number)[] = ['SET', key, JSON.stringify(value)];
    if (exSeconds) cmd.push('EX', exSeconds);

    const results = await this.pipeline([cmd]);
    const item = results[0];

    if (item.error) {
      throw new Error(`Upstash SET "${key}" error: ${item.error}`);
    }
  }
}

// ── File-based storage (local development) ────────────────────────────────────

class FileKV implements KV {
  private data: Record<string, { value: unknown; exAt?: number }> = {};
  private readonly filePath = '.treactions-data.json';
  private loaded = false;

  private async load() {
    if (this.loaded) return;
    try {
      const { readFileSync } = await import('fs');
      const raw = readFileSync(this.filePath, 'utf-8');
      this.data = JSON.parse(raw);
    } catch {
      this.data = {};
    }
    this.loaded = true;
  }

  private async persist() {
    try {
      const { writeFileSync } = await import('fs');
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('[FileKV] persist error:', err);
    }
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

// ── Factory ───────────────────────────────────────────────────────────────────

function createKV(): KV {
  const url   = process.env.KV_REST_API_URL   ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    console.log('[storage] Upstash endpoint:', url.replace(/^(https:\/\/[^/]{0,30}).*/, '$1…'));
    return new UpstashKV(url, token);
  }

  console.log('[storage] KV env vars not found — using local file storage (.treactions-data.json)');
  return new FileKV();
}

// Module-level singleton — one instance per serverless cold start
let kv: KV | null = null;
function getKV(): KV {
  if (!kv) kv = createKV();
  return kv;
}

// ── Safe value coercion ───────────────────────────────────────────────────────
// Handles: null → [], string (JSON) → parsed, object → direct, broken → []
function toArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
    catch { return []; }
  }
  return [];
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getBots(): Promise<Bot[]> {
  try {
    const raw = await getKV().get<unknown>(BOTS_KEY);
    const bots = toArray<Bot>(raw);
    console.log(`[storage] getBots → ${bots.length} bot(s)`);
    return bots;
  } catch (err) {
    // Never crash the GET /api/bots endpoint — return empty list
    console.error('[storage] getBots FAILED (returning []):', err);
    return [];
  }
}

export async function saveBots(bots: Bot[]): Promise<void> {
  console.log(`[storage] saveBots → ${bots.length} bot(s), key="${BOTS_KEY}"`);
  await getKV().set(BOTS_KEY, bots); // intentionally throws — POST must know
  console.log('[storage] saveBots → OK');
}

export async function getConfig(): Promise<GlobalConfig> {
  try {
    const raw = await getKV().get<GlobalConfig>(CONFIG_KEY);
    return raw ?? { ...DEFAULT_CONFIG };
  } catch (err) {
    console.error('[storage] getConfig FAILED (returning default):', err);
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: GlobalConfig): Promise<void> {
  await getKV().set(CONFIG_KEY, config);
}

export async function getLogs(): Promise<ReactionLog[]> {
  try {
    const raw = await getKV().get<unknown>(LOGS_KEY);
    return toArray<ReactionLog>(raw);
  } catch (err) {
    console.error('[storage] getLogs FAILED (returning []):', err);
    return [];
  }
}

export async function appendLog(log: ReactionLog): Promise<void> {
  const logs = await getLogs();
  logs.unshift(log);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  await getKV().set(LOGS_KEY, logs);
}

export async function clearLogs(): Promise<void> {
  await getKV().set(LOGS_KEY, []);
}

export async function hasReacted(
  chatId: number | string,
  messageId: number,
  botId: string,
): Promise<boolean> {
  try {
    const key = `treactions:rx:${chatId}:${messageId}:${botId}`;
    return (await getKV().get<boolean>(key)) === true;
  } catch {
    return false;
  }
}

export async function markReacted(
  chatId: number | string,
  messageId: number,
  botId: string,
): Promise<void> {
  const key = `treactions:rx:${chatId}:${messageId}:${botId}`;
  await getKV().set(key, true, Math.floor(REACTION_TTL_MS / 1000));
}

// ── Flows ─────────────────────────────────────────────────────────────────────

export async function getFlows(): Promise<Flow[]> {
  try {
    const raw = await getKV().get<unknown>(FLOWS_KEY);
    return toArray<Flow>(raw);
  } catch (err) {
    console.error('[storage] getFlows FAILED (returning []):', err);
    return [];
  }
}

export async function saveFlows(flows: Flow[]): Promise<void> {
  await getKV().set(FLOWS_KEY, flows);
}
