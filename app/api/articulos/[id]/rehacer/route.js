import { NextResponse } from 'next/server';
import { rehacerArticulo } from '@/lib/procesadorCore.cjs';

export const maxDuration = 90;

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const articuloId = Number(id);

    if (!articuloId || Number.isNaN(articuloId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de artículo inválido' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const indicaciones = String(body.indicaciones || '').slice(0, 2000);
    const resultado = await rehacerArticulo(articuloId, indicaciones);

    return NextResponse.json({
      ok: true,
      articulo: resultado.articulo,
      titulo_generado: resultado.titulo_generado,
      contenido_generado: resultado.contenido_generado,
    });
  } catch (error) {
    const mensaje = error.message || 'No se pudo rehacer la nota';
    const status = /no encontrad|no tiene nota|inválido|publicado o programado/i.test(mensaje)
      ? 400
      : 500;

    return NextResponse.json({ ok: false, error: mensaje }, { status });
  }
}
