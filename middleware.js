import { NextResponse } from 'next/server';
import {
  credencialesDashboardConfiguradas,
  esRutaPublica,
  getCookieSesion,
  verificarTokenSesion,
} from '@/lib/auth';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (!credencialesDashboardConfiguradas()) {
    return NextResponse.next();
  }

  if (esRutaPublica(pathname)) {
    if (pathname === '/login') {
      const token = getCookieSesion(request);
      const valido = await verificarTokenSesion(
        token,
        process.env.DASHBOARD_USER,
        process.env.DASHBOARD_PASSWORD,
      );

      if (valido) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    return NextResponse.next();
  }

  const token = getCookieSesion(request);
  const valido = await verificarTokenSesion(
    token,
    process.env.DASHBOARD_USER,
    process.env.DASHBOARD_PASSWORD,
  );

  if (valido) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
