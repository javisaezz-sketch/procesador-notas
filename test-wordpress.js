require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const medioId = process.argv[2] || 1;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  );

  const { data: medio, error } = await supabase
    .from('medios')
    .select('id, nombre, url_wordpress, api_user, api_password')
    .eq('id', medioId)
    .single();

  if (error || !medio) {
    console.error('No se pudo leer el medio:', error?.message || 'Sin datos');
    process.exit(1);
  }

  const baseUrl = medio.url_wordpress.trim().replace(/\/+$/, '');
  const user = medio.api_user.trim();
  const pass = medio.api_password.replace(/\s+/g, '');
  const auth = Buffer.from(`${user}:${pass}`).toString('base64');

  console.log(`\nMedio: ${medio.nombre}`);
  console.log(`URL: ${baseUrl}`);
  console.log(`Usuario configurado: ${user}\n`);

  const meResponse = await fetch(`${baseUrl}/wp-json/wp/v2/users/me?context=edit`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  });

  const meBody = await meResponse.json();

  if (!meResponse.ok) {
    console.error('❌ Autenticación fallida');
    console.error(meBody);
    process.exit(1);
  }

  console.log('✅ Usuario autenticado en WordPress:');
  console.log(`   slug: ${meBody.slug}`);
  console.log(`   nombre: ${meBody.name}`);
  console.log(`   roles: ${(meBody.roles || []).join(', ') || 'sin roles'}`);
  console.log(`   id: ${meBody.id}`);

  const postResponse = await fetch(`${baseUrl}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      title: 'Prueba API dashboard',
      content: '<p>Entrada de prueba generada desde test-wordpress.js</p>',
      status: 'draft',
      author: meBody.id,
    }),
  });

  const postBody = await postResponse.json();

  if (!postResponse.ok) {
    console.error('\n❌ WordPress no permite crear entradas');
    console.error(postBody);
    process.exit(1);
  }

  console.log('\n✅ Entrada de prueba creada correctamente');
  console.log(`   ID borrador: ${postBody.id}`);
  console.log(`   Editar en WP: ${baseUrl}/wp-admin/post.php?post=${postBody.id}&action=edit`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
