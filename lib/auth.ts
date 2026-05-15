// ── Session token ─────────────────────────────────────────────────────────────
//
// Format: base64(payload) + "." + base64(hmac)
// payload: JSON { u: username, exp: unix-ms }
// HMAC-SHA-256 signed with AUTH_SECRET env var (falls back to ADMIN_PASSWORD)
//
// Uses Web Crypto API — works in both Edge Runtime (middleware) and Node.js.

export const COOKIE  = 'tr_session';
export const TTL_DAYS = 7;

function secret(): string {
  return (
    process.env.AUTH_SECRET ??
    process.env.ADMIN_PASSWORD ??
    'treactions-fallback-secret'
  );
}

async function importKey(s: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(s),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function unb64(s: string): ArrayBuffer {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

export async function createToken(username: string): Promise<string> {
  const exp     = Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000;
  const payload = btoa(JSON.stringify({ u: username, exp }));
  const key     = await importKey(secret());
  const sig     = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${b64(sig)}`;
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;
    const payload = token.slice(0, dot);
    const sigB64  = token.slice(dot + 1);

    const key   = await importKey(secret());
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      unb64(sigB64),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;

    const { u, exp } = JSON.parse(atob(payload)) as { u: string; exp: number };
    if (Date.now() > exp) return null;
    return u;
  } catch {
    return null;
  }
}
