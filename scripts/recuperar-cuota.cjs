require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function run(label, command) {
  console.log(`\n▶ ${label}`);
  try {
    execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    return true;
  } catch {
    console.error(`   ❌ Falló: ${label}`);
    return false;
  }
}

async function bucketPrivado() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const response = await fetch(`${url}/storage/v1/bucket/notas-prensa`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ public: false }),
  });

  const body = await response.text();
  console.log(`   Bucket notas-prensa → public=false (${response.status}) ${body.slice(0, 80)}`);
  return response.ok;
}

async function main() {
  console.log('══════════════════════════════════════');
  console.log('  Recuperación de cuota Supabase');
  console.log('══════════════════════════════════════');

  if (!run('Comprobar Supabase', 'node scripts/verificar-supabase.cjs')) {
    console.log('\n⛔ Para continuar:');
    console.log('   1. Entra en https://supabase.com/dashboard');
    console.log('   2. Si el proyecto está pausado, pulsa Restore / Reactivar');
    console.log('   3. Settings → API → copia Project URL y claves a .env');
    console.log('   4. Vuelve a ejecutar: npm run recuperar-cuota');
    process.exit(1);
  }

  await bucketPrivado();

  run('Limpiar storage y HTML de notas cerradas', 'node scripts/limpiar-supabase.cjs');

  console.log('\n▶ Seguridad RLS (SQL)');
  if (process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_URL) {
    run('Aplicar RLS', 'node scripts/aplicar-seguridad-rls.cjs');
  } else {
    console.log('   ℹ️  Añade SUPABASE_DB_PASSWORD al .env y ejecuta: npm run seguridad-rls');
    console.log('   ℹ️  O pega supabase-seguridad-rls.sql en Supabase → SQL Editor');
  }

  run('Verificar anon bloqueada', 'node scripts/verificar-seguridad-rls.cjs');

  console.log('\n✅ Pasos automáticos terminados.');
  console.log('   Actualiza SUPABASE_* en GitHub Secrets y Vercel si cambiaste la URL.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
