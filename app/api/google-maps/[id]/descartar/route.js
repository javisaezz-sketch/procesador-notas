import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { descartarReviewGoogleMaps } from '@/lib/googleMaps';

export const dynamic = 'force-dynamic';

export async function POST(_request, { params }) {
  try {
    const { id } = await params;
    const reviewId = decodeURIComponent(id);

    if (!reviewId) {
      return NextResponse.json(
        { ok: false, error: 'ID de reseña inválido' },
        { status: 400 },
      );
    }

    const supabase = createSupabaseClient();
    await descartarReviewGoogleMaps(supabase, reviewId);

    return NextResponse.json({
      ok: true,
      message: 'Reseña de Google Maps descartada',
    });
  } catch (error) {
    console.error('[API /api/google-maps/[id]/descartar] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error al descartar reseña de Google Maps',
      },
      { status: 500 },
    );
  }
}
