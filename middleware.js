import { NextResponse } from 'next/server';

function pedirLogin() {
  return new NextResponse('Acceso restringido al panel.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Panel SAEZ&NAVES Media Group"',
    },
  });
}

function credencialesValidas(request, usuario, password) {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64 = authorization.slice(6);
    const decoded = atob(base64);
    const separador = decoded.indexOf(':');
    if (separador === -1) return false;

    const user = decoded.slice(0, separador);
    const pass = decoded.slice(separador + 1);

    return user === usuario && pass === password;
  } catch {
    return false;
  }
}

export function middleware(request) {
  const usuario = process.env.DASHBOARD_USER;
  const password = process.env.DASHBOARD_PASSWORD;

  if (!usuario || !password) {
    return NextResponse.next();
  }

  if (credencialesValidas(request, usuario, password)) {
    return NextResponse.next();
  }

  return pedirLogin();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
