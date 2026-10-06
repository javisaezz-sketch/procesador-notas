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
    const etiquetasInstagram = String(body.etiquetasInstagram || '').trim();

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
      const { nicks, avisos } = parsearNicksInstagram(etiquetasInstagram);
      const guardados = [];
      if (categoriaSlug === 'feed') {
        for (const nick of nicks) {
          const candidato = [...guardados, nick].join(',');
          if (`feed:${candidato}`.length > 80) {
            avisos.push(`@${nick} no cabe al programar y no se etiquetará.`);
            continue;
          }
          guardados.push(nick);
        }
      }
      const slugProgramado = guardados.length && categoriaSlug === 'feed'
        ? `feed:${guardados.join(',')}`
        : categoriaSlug;
      const programado = await programarArticulo(articuloId, {
        cuando: programarEn,
        categoriaSlug: slugProgramado,
        publicarEnWeb,
        notificar,
        emailNotificacion,
      });
      const avisoEtiquetas = avisos.length ? avisos.join(' ') : null;
      const previstas = guardados.length
        ? ` Se intentará etiquetar a ${guardados.map((nick) => `@${nick}`).join(', ')}.`
        : '';
      return NextResponse.json({
        ok: true,
        programado: true,
        message: `Publicación programada.${previstas}${avisoEtiquetas ? ` ${avisoEtiquetas}` : ''}`,
        avisoEtiquetas,
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
      const aviso = resultado.avisoEtiquetas ? ` ${resultado.avisoEtiquetas}` : '';
      return NextResponse.json({
        ok: true,
        message: `Publicado con éxito en Instagram (@laglamdelbuenvivir).${cola}${aviso}`,
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
