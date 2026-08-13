import { NextResponse } from 'next/server';
import { actualizarArticulo } from '@/lib/articulos';

export async function PATCH(request, { params }) {
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
    const cambios = {};

    if (body.titulo_generado !== undefined) {
      cambios.titulo_generado = String(body.titulo_generado);
    }

    if (body.contenido_generado !== undefined) {
      cambios.contenido_generado = String(body.contenido_generado);
    }

    if (body.imagen_destacada_url !== undefined) {
      cambios.imagen_destacada_url = body.imagen_destacada_url;
    }

    if (body.imagenes_publicar_urls !== undefined) {
      cambios.imagenes_publicar_urls = body.imagenes_publicar_urls;
    }

    const articulo = await actualizarArticulo(articuloId, cambios);

    return NextResponse.json({ ok: true, articulo });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error desconocido al guardar',
      },
      { status: 500 },
    );
  }
}
