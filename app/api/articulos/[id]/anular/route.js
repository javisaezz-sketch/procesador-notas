import { NextResponse } from 'next/server';
import { anularArticulo } from '@/lib/articulos';

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

    const articulo = await anularArticulo(articuloId);

    return NextResponse.json({
      ok: true,
      message: 'Artículo anulado',
      articulo,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error desconocido al anular',
      },
      { status: 500 },
    );
  }
}
