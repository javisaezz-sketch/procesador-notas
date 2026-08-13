import { NextResponse } from 'next/server';
import { publicarArticulo, publicarPostEnWordPress } from '@/lib/publicarArticulo';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const articuloId = Number(id);
    const body = await request.json().catch(() => ({}));
    const categoriaSlug = body.categoriaSlug;
    const publicarEnWeb = body.publicarEnWeb === true;

    if (!articuloId || Number.isNaN(articuloId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de artículo inválido' },
        { status: 400 },
      );
    }

    if (!categoriaSlug) {
      return NextResponse.json(
        { ok: false, error: 'Debes seleccionar una categoría' },
        { status: 400 },
      );
    }

    const resultado = await publicarArticulo(articuloId, categoriaSlug);

    if (publicarEnWeb) {
      const enWeb = await publicarPostEnWordPress(articuloId);

      return NextResponse.json({
        ok: true,
        message: 'Artículo publicado en la web',
        publicadoEnWeb: true,
        ...resultado,
        ...enWeb,
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Artículo enviado a WordPress como borrador',
      publicadoEnWeb: false,
      ...resultado,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error desconocido al publicar',
      },
      { status: 500 },
    );
  }
}
