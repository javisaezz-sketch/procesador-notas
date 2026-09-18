import { NextResponse } from 'next/server';
import { normalizeSupabaseUrl } from '@/lib/normalizeSupabaseUrl';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Faltan SUPABASE_URL o clave en el entorno de Vercel',
        hasUrl: Boolean(url),
        hasKey: Boolean(key),
      },
      { status: 500 },
    );
  }

  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_URL inválida', urlPreview: url.slice(0, 40) },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/articulos?select=id&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        cache: 'no-store',
      },
    );

    const body = await response.text();

    return NextResponse.json({
      ok: response.ok,
      hostname,
      status: response.status,
      articulosSample: response.ok ? 'reachable' : body.slice(0, 120),
      hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        hostname,
        error: error.message,
        cause: error.cause?.message ?? error.cause?.code ?? null,
      },
      { status: 500 },
    );
  }
}
