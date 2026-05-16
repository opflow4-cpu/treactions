import { NextResponse } from 'next/server';
import { getMemberEvents, clearMemberEvents } from '@/lib/storage';

// GET — retorna todos os eventos de membros
export async function GET() {
  const events = await getMemberEvents();
  return NextResponse.json({ ok: true, events });
}

// DELETE — limpa o histórico
export async function DELETE() {
  await clearMemberEvents();
  return NextResponse.json({ ok: true });
}
