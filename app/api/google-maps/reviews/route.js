import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { getGoogleMapsReviewsPendientes } from '@/lib/googleMaps';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const forzarSync = searchParams.get('sync') === 'true';

    const supabase = createSupabaseClient();
    const reviews = await getGoogleMapsReviewsPendientes(supabase, forzarSync);

    return NextResponse.json({
      ok: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error('[API /api/google-maps/reviews] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error al obtener reseñas de Google Maps',
      },
      { status: 500 },
    );
  }
}
