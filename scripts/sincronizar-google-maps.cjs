require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const { getGoogleMapsReviewsPendientes } = await import('../lib/googleMaps.js');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );

  console.log('🔄 Sincronizando reseñas de Google Maps con Supabase...');
  const reviews = await getGoogleMapsReviewsPendientes(supabase, true);

  console.log(`✅ Sincronización completada: ${reviews.length} reseña(s) pendiente(s).\n`);
  reviews.forEach((r, i) => {
    console.log(
      `[${i + 1}] ${r.place_name} (${r.city}) - ${'★'.repeat(r.stars)} (${r.stars}/5) - ${r.fotos?.length || 0} foto(s)`,
    );
  });
}

main().catch((err) => {
  console.error('❌ Error al sincronizar:', err);
  process.exit(1);
});
