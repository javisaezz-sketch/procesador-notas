import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import {
  generarPostInstagramDesdeReview,
  revertirPublicacionFallidaGoogleMaps,
} from '@/lib/googleMaps';
import { publicarArticulo } from '@/lib/publicarArticulo';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { review, fotoSeleccionadaUrl, fotosSeleccionadas, instruccionesEditor, etiquetasInstagram } = body;

    if (!review) {
      return NextResponse.json(
        { ok: false, error: 'Faltan los datos de la reseña en la petición' },
        { status: 400 },
      );
    }

    const reviewData = {
      ...review,
      review_id: review.review_id || id,
    };

    const supabase = createSupabaseClient();
    const resultado = await generarPostInstagramDesdeReview({
      supabase,
      review: reviewData,
      fotoSeleccionadaUrl,
      fotosSeleccionadas,
      instruccionesEditor,
    });

    try {
      const publicado = await publicarArticulo(resultado.articulo.id, 'feed', {
        etiquetasInstagram: String(etiquetasInstagram || ''),
      });
      const etiquetadas = Array.isArray(publicado.etiquetadas) ? publicado.etiquetadas : [];
      const cola = etiquetadas.length
        ? ` Etiquetadas: ${etiquetadas.map((nick) => `@${nick}`).join(', ')}.`
        : '';
      const aviso = publicado.avisoEtiquetas ? ` ${publicado.avisoEtiquetas}` : '';
      return NextResponse.json({
        ok: true,
        publicado: true,
        message: `Post publicado en Instagram (@laglamdelbuenvivir).${cola}${aviso}`,
        avisoEtiquetas: publicado.avisoEtiquetas || null,
        articulo: publicado.articulo || resultado.articulo,
        notaId: resultado.notaId,
        instagramUrl: publicado.wordpressPostUrl || null,
      });
    } catch (publishError) {
      console.error(
        '[API /api/google-maps/[id]/generar] Post generado pero no publicado:',
        publishError,
      );
      await revertirPublicacionFallidaGoogleMaps(supabase, {
        articuloId: resultado.articulo?.id,
        notaId: resultado.notaId,
      });
      return NextResponse.json(
        {
          ok: false,
          publicado: false,
          error:
            publishError.message ||
            'Instagram no pudo publicar el post. La reseña sigue en Google Maps para reintentarlo.',
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error('[API /api/google-maps/[id]/generar] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error al generar el post de Instagram con IA',
      },
      { status: 500 },
    );
  }
}
