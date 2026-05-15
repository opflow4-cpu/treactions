import { NextResponse } from 'next/server';
import { getOnboardingLogs, clearOnboardingLogs } from '@/lib/storage';

export async function GET() {
  const logs = await getOnboardingLogs();
  return NextResponse.json(logs);
}

export async function DELETE() {
  await clearOnboardingLogs();
  return NextResponse.json({ ok: true });
}
