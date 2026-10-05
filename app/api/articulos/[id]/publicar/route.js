import { NextResponse } from 'next/server';
import { publicarArticulo, publicarPostEnWordPress } from '@/lib/publicarArticulo';
import { programarArticulo } from '@/lib/programarPublicacion';
import { parsearNicksInstagram } from '@/lib/instagram';

export const maxDuration = 120;

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const articuloId = Number(id);
    const body = await request.json().catch(() => ({}));
    const categoriaSlug = body.categoriaSlug;
    const publicarEnWeb = body.publicarEnWeb === true;
    const programarEn = body.programarEn || null;
    const notificar = body.notificar === true ? true : body.notificar === false ? false : null;
    const emailNotificacion = body.emailNotificacion || null;
    let etiquetasInstagram = '';
    try {
      etiquetasInstagram = parsearNicksInstagram(body.etiquetasInstagram).join(',');
    } catch (nickError) {
      return NextResponse.json(
        { ok: false, error: nickError.message },
        { status: 400 },
      );
    }

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

    if (programarEn) {
      const slugProgramado = etiquetasInstagram && categoriaSlug === 'feed'
        ? `feed:${etiquetasInstagram}`
        : categoriaSlug;
      if (String(slugProgramado || '').length > 80) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Son demasiadas etiquetas para dejarlas programadas. Publica ahora o deja menos cuentas.',
          },
          { status: 400 },
        );
      }
      const programado = await programarArticulo(articuloId, {
        cuando: programarEn,
        categoriaSlug: slugProgramado,
        publicarEnWeb,
        notificar,
        emailNotificacion,
      });
      return NextResponse.json({
        ok: true,
        programado: true,
        message: etiquetasInstagram
          ? `Publicación programada. Se etiquetará a ${etiquetasInstagram.split(',').map((nick) => `@${nick}`).join(', ')}.`
          : 'Publicación programada',
        fecha_programada: programado.articulo.fecha_programada,
        articulo: programado.articulo,
      });
    }

    const resultado = await publicarArticulo(articuloId, categoriaSlug, {
      notificar,
      emailNotificacion,
      etiquetasInstagram,
    });

    if (resultado.esInstagram) {
      const etiquetadas = Array.isArray(resultado.etiquetadas) ? resultado.etiquetadas : [];
      const cola = etiquetadas.length
        ? ` Etiquetadas: ${etiquetadas.map((nick) => `@${nick}`).join(', ')}.`
        : '';
      return NextResponse.json({
        ok: true,
        message: `Publicado con éxito en Instagram (@laglamdelbuenvivir).${cola}`,
        publicadoEnWeb: true,
        ...resultado,
      });
    }

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
