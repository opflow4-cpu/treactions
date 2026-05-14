import { NextResponse } from 'next/server';

// GET /api/debug/kv
// Tests the Upstash connection end-to-end and returns a full diagnostic report.
// Remove or protect this endpoint in production after debugging.
export async function GET() {
  const url   = process.env.KV_REST_API_URL   ?? process.env.UPSTASH_REDIS_REST_URL ?? '';
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

  if (!url || !token) {
    return NextResponse.json({
      ok: false,
      error: 'KV_REST_API_URL / KV_REST_API_TOKEN not set',
      usingFileStorage: true,
    });
  }

  const pipelineUrl = `${url.replace(/\/+$/, '')}/pipeline`;
  const testKey = 'treactions:debug-ping';
  const testVal = `ping-${Date.now()}`;
  const report: Record<string, unknown> = {
    url: url.replace(/^(https:\/\/[^/]{0,30}).*/, '$1…'),
    pipelineUrl: pipelineUrl.replace(/^(https:\/\/[^/]{0,30}).*/, '$1…'),
  };

  // 1. SET
  try {
    const setRes = await fetch(pipelineUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', testKey, testVal, 'EX', '60']]),
      cache: 'no-store',
    });
    const setBody = await setRes.json();
    report.set = { status: setRes.status, body: setBody };
  } catch (err) {
    report.set = { error: String(err) };
  }

  // 2. GET
  try {
    const getRes = await fetch(pipelineUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['GET', testKey]]),
      cache: 'no-store',
    });
    const getBody = await getRes.json();
    report.get = { status: getRes.status, body: getBody };

    const result = (getBody as Array<{ result: unknown }>)[0]?.result;
    report.roundTrip = result === testVal ? 'OK ✓' : `MISMATCH — expected "${testVal}", got "${result}"`;
  } catch (err) {
    report.get = { error: String(err) };
  }

  // 3. Read current bots key
  try {
    const botsRes = await fetch(pipelineUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['GET', 'treactions:bots']]),
      cache: 'no-store',
    });
    const botsBody = await botsRes.json();
    const rawBots = (botsBody as Array<{ result: unknown }>)[0]?.result;
    report.botsRaw = rawBots;
    report.botsType = typeof rawBots;
    if (typeof rawBots === 'string') {
      try { report.botsParsed = JSON.parse(rawBots); }
      catch { report.botsParseError = 'not valid JSON'; }
    }
  } catch (err) {
    report.bots = { error: String(err) };
  }

  return NextResponse.json(report, { status: 200 });
}
