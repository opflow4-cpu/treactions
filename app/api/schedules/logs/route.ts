import { NextResponse } from 'next/server';
import { getScheduleLogs, clearScheduleLogs } from '@/lib/storage';

export async function GET() {
  const logs = await getScheduleLogs();
  return NextResponse.json(logs);
}

export async function DELETE() {
  await clearScheduleLogs();
  return NextResponse.json({ ok: true });
}
