const requeridas = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
];

const faltantes = requeridas.filter((nombre) => !process.env[nombre]?.trim());

if (faltantes.length) {
  console.error('❌ Faltan secrets en GitHub Actions:');
  faltantes.forEach((nombre) => console.error(`   - ${nombre}`));
  console.error('');
  console.error('Ve a Settings → Secrets → Actions y créalos.');
  process.exit(1);
}

if (!process.env.GEMINI_MODEL?.trim()) {
  console.log('ℹ️  GEMINI_MODEL no definido; se usará gemini-3.6-flash');
}

console.log('✅ Secrets detectados correctamente');
