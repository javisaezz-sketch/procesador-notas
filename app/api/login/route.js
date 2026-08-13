import { NextResponse } from 'next/server';
import {
  COOKIE_NAME,
  crearTokenSesion,
  credencialesDashboardConfiguradas,
} from '@/lib/auth';

export async function POST(request) {
  if (!credencialesDashboardConfiguradas()) {
    return NextResponse.json(
      { ok: false, error: 'Login no configurado en el servidor' },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const usuario = String(body.usuario ?? '').trim();
  const password = String(body.password ?? '');
  const recordar = body.recordar === true;

  const usuarioEsperado = process.env.DASHBOARD_USER.trim();
  const passwordEsperado = process.env.DASHBOARD_PASSWORD;

  if (usuario !== usuarioEsperado || password !== passwordEsperado) {
    return NextResponse.json(
      { ok: false, error: 'Usuario o contraseña incorrectos' },
      { status: 401 },
    );
  }

  const token = await crearTokenSesion(usuarioEsperado, passwordEsperado);
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: recordar ? 60 * 60 * 24 * 30 : undefined,
  });

  return response;
}
