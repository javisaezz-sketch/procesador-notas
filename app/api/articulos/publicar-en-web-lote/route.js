import { NextResponse } from 'next/server';
import { publicarPostEnWordPress } from '@/lib/publicarArticulo';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.map(Number).filter((id) => id > 0 && !Number.isNaN(id)))]
      : [];

    if (!ids.length) {
      return NextResponse.json(
        { ok: false, error: 'No hay artículos seleccionados' },
        { status: 400 },
      );
    }

    const resultados = [];
    const errores = [];

    for (const id of ids) {
      try {
        const resultado = await publicarPostEnWordPress(id);
        resultados.push({ id, ok: true, ...resultado });
      } catch (error) {
        errores.push({
          id,
          ok: false,
          error: error.message || 'Error desconocido',
        });
      }
    }

    return NextResponse.json({
      ok: errores.length === 0,
      publicados: resultados.length,
      fallidos: errores.length,
      resultados,
      errores,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error desconocido al publicar en lote',
      },
      { status: 500 },
    );
  }
}
