import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, COOKIE } from '@/lib/auth';

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const user = await verifyToken(token);
  if (!user) {
    // Token inválido ou expirado — apaga cookie e redireciona
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete(COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Aplica o proxy em TODAS as rotas exceto:
   *   - /login             (tela de login — pública)
   *   - /api/auth/*        (endpoints de login/logout — públicos)
   *   - /api/webhook/*     (webhooks do Telegram — devem ser públicos)
   *   - _next/*            (assets Next.js)
   *   - favicon.ico
   */
  matcher: [
    '/((?!login|api/auth|api/webhook|_next/static|_next/image|favicon\\.ico).*)',
  ],
};
