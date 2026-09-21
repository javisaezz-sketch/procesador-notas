/**
 * Hace privado el bucket notas-prensa (equivalente a supabase-reducir-egress.sql paso 1).
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
 *
 * Las políticas RLS del SQL hay que aplicarlas en Supabase → SQL Editor si falla el acceso.
 */
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: bucket, error: readError } = await supabase.storage.getBucket(
    'notas-prensa',
  );

  if (readError) {
    console.error('No se pudo leer el bucket notas-prensa:', readError.message);
    process.exit(1);
  }

  console.log('Estado actual:', {
    id: bucket.id,
    public: bucket.public,
  });

  if (bucket.public === false) {
    console.log('El bucket ya es privado. Nada que hacer.');
    return;
  }

  const { data: updated, error: updateError } = await supabase.storage.updateBucket(
    'notas-prensa',
    { public: false },
  );

  if (updateError) {
    console.error('No se pudo hacer privado el bucket:', updateError.message);
    console.error(
      'Ejecuta manualmente supabase-reducir-egress.sql en Supabase → SQL Editor.',
    );
    process.exit(1);
  }

  console.log('Bucket actualizado:', {
    id: updated?.id ?? 'notas-prensa',
    public: updated?.public ?? false,
  });
  console.log('');
  console.log('Recomendado: ejecuta también supabase-reducir-egress.sql en SQL Editor');
  console.log('(política service_role) y verifica el panel con Ctrl+F5.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
