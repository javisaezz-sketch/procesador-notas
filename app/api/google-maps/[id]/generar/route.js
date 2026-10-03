import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { generarPostInstagramDesdeReview } from '@/lib/googleMaps';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { review, fotoSeleccionadaUrl, instruccionesEditor } = body;

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
      instruccionesEditor,
    });

    return NextResponse.json({
      ok: true,
      message: 'Post de Instagram generado con éxito para @laglamdelbuenvivir',
      articulo: resultado.articulo,
      notaId: resultado.notaId,
    });
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
