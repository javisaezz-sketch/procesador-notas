import { NextResponse } from 'next/server';
import { publicarPostEnWordPress } from '@/lib/publicarArticulo';

export async function POST(_request, { params }) {
  try {
    const { id } = await params;
    const articuloId = Number(id);

    if (!articuloId || Number.isNaN(articuloId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de artículo inválido' },
        { status: 400 },
      );
    }

    const resultado = await publicarPostEnWordPress(articuloId);

    return NextResponse.json({
      ok: true,
      message: 'Artículo publicado en la web',
      ...resultado,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error desconocido al publicar en WordPress',
      },
      { status: 500 },
    );
  }
}
