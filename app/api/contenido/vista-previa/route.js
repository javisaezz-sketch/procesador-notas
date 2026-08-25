import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/ingestNota';
import { firmarImagenesEnContenidoHtml } from '@/lib/urlsImagenStorage';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const html = typeof body.html === 'string' ? body.html : '';

    if (!html.trim()) {
      return NextResponse.json({ ok: true, html: '' });
    }

    const htmlFirmado = await firmarImagenesEnContenidoHtml(createSupabaseAdmin(), html);

    return NextResponse.json({ ok: true, html: htmlFirmado });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'No se pudo preparar la vista previa',
      },
      { status: 500 },
    );
  }
}
