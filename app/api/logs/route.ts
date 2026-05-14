import { NextResponse } from 'next/server';
import { getLogs, clearLogs } from '@/lib/storage';

export async function GET() {
  const logs = await getLogs();
  return NextResponse.json(logs);
}

export async function DELETE() {
  await clearLogs();
  return NextResponse.json({ ok: true });
}
