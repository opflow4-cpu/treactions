import { NextRequest, NextResponse } from 'next/server';
import { createToken, COOKIE, TTL_DAYS } from '@/lib/auth';

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const { username = '', password = '' } = body;

  const validUser = process.env.ADMIN_USERNAME?.trim() || 'admin';
  const validPass = process.env.ADMIN_PASSWORD?.trim() ?? '';

  if (!validPass) {
    return NextResponse.json(
      { error: 'Servidor sem senha configurada. Defina ADMIN_PASSWORD nas variáveis de ambiente.' },
      { status: 500 },
    );
  }

  // Pequeno delay para dificultar brute-force
  await new Promise((r) => setTimeout(r, 400));

  if (username.trim() !== validUser || password !== validPass) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos.' }, { status: 401 });
  }

  const token = await createToken(username.trim());

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TTL_DAYS * 24 * 60 * 60,
    path: '/',
  });
  return res;
}
