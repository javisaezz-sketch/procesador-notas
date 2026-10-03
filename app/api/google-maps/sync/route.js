import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { getGoogleMapsReviewsPendientes } from '@/lib/googleMaps';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = createSupabaseClient();
    const reviews = await getGoogleMapsReviewsPendientes(supabase, true);

    return NextResponse.json({
      ok: true,
      count: reviews.length,
      reviews,
      message: `Sincronización completada. ${reviews.length} reseña(s) pendiente(s).`,
    });
  } catch (error) {
    console.error('[API /api/google-maps/sync] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error al sincronizar con Google Maps',
      },
      { status: 500 },
    );
  }
}
