require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function probarAcceso(label, key) {
  const supabase = createClient(process.env.SUPABASE_URL, key);

  const pruebas = [
    supabase.from('articulos').select('id').limit(1),
    supabase.from('notas_prensa').select('id').limit(1),
    supabase.from('medios').select('id').limit(1),
  ];

  const resultados = await Promise.all(pruebas);
  const bloqueado = resultados.every(
    (resultado) => resultado.error || (resultado.data ?? []).length === 0,
  );

  console.log(`${label}: ${bloqueado ? 'bloqueado/ sin filas' : 'ACCESO PERMITIDO'}`);

  for (const resultado of resultados) {
    if (resultado.error) {
      console.log(`  error: ${resultado.error.message}`);
    } else {
      console.log(`  filas: ${resultado.data?.length ?? 0}`);
    }
  }

  return bloqueado;
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log('Verificando seguridad RLS...\n');

  const anonBloqueada = process.env.SUPABASE_ANON_KEY
    ? await probarAcceso('Anon key', process.env.SUPABASE_ANON_KEY)
    : null;

  console.log('');
  const serviceBloqueada = await probarAcceso(
    'Service role',
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  console.log('\nResumen:');
  if (anonBloqueada === null) {
    console.log('- Anon key: no configurada en .env');
  } else if (anonBloqueada) {
    console.log('- Anon key: OK (no lee tablas sensibles)');
  } else {
    console.log('- Anon key: PELIGRO (aún puede leer datos)');
  }

  if (!serviceBloqueada) {
    console.log('- Service role: OK (panel/pipeline pueden seguir operando)');
  } else {
    console.log('- Service role: PROBLEMA (revisa permisos o service role key)');
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
