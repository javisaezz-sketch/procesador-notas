const COOKIE_NAME = 'panel_session';

async function crearTokenSesion(user, password) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`dashboard:${user}`),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verificarTokenSesion(token, user, password) {
  if (!token?.trim() || !user?.trim() || !password?.trim()) {
    return false;
  }

  const esperado = await crearTokenSesion(user, password);
  return token === esperado;
}

export function credencialesDashboardConfiguradas() {
  return Boolean(
    process.env.DASHBOARD_USER?.trim() && process.env.DASHBOARD_PASSWORD?.trim(),
  );
}

export function getCookieSesion(request) {
  return request.cookies.get(COOKIE_NAME)?.value ?? null;
}

export function esRutaPublica(pathname) {
  return (
    pathname === '/login' ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/api/logout')
  );
}

export { COOKIE_NAME, crearTokenSesion };
