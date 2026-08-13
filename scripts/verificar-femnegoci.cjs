require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );

  const { data: medio, error } = await supabase
    .from('medios')
    .select('*')
    .eq('slug', 'femnegoci')
    .single();

  if (error || !medio) {
    throw new Error('Fem Negoci no existe en Supabase. Ejecuta scripts/insertar-medio-femnegoci.cjs');
  }

  console.log('Fem Negoci en Supabase');
  console.log('======================');
  console.log(`ID: ${medio.id}`);
  console.log(`WordPress: ${medio.url_wordpress}`);
  console.log(`Usuario WP: ${medio.api_user}`);
  console.log(`Contraseña WP: ${medio.api_password ? 'configurada' : 'FALTA'}`);
  console.log(`Buzón POP3: ${medio.email_pop_user} @ ${medio.email_pop_host}:${medio.email_pop_port}`);
  console.log(`Categorías: ${medio.categorias_json?.length ?? 0}`);
  console.log(`Prompt: ${medio.prompt_personalidad?.length ?? 0} caracteres`);

  const baseUrl = medio.url_wordpress.trim().replace(/\/+$/, '');
  const auth = Buffer.from(
    `${medio.api_user.trim()}:${medio.api_password.replace(/\s+/g, '')}`,
  ).toString('base64');

  const response = await fetch(`${baseUrl}/wp-json/wp/v2/users/me?context=edit`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`WordPress rechazó la conexión: ${body.message || response.status}`);
  }

  console.log('');
  console.log('WordPress OK');
  console.log(`  Usuario: ${body.slug} (${(body.roles || []).join(', ')})`);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
