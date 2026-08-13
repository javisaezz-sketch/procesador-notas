import { NextResponse } from 'next/server';
import { getImagenesArticulo } from '@/lib/articulos';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const articuloId = Number(id);

    if (!articuloId || Number.isNaN(articuloId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de artículo inválido' },
        { status: 400 },
      );
    }

    const data = await getImagenesArticulo(articuloId);

    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'No se pudieron cargar las imágenes',
      },
      { status: 500 },
    );
  }
}
