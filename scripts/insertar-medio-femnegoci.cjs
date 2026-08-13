require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );

  const prompt = fs.readFileSync(
    path.join(__dirname, '../prompt-femnegoci.txt'),
    'utf8',
  );

  const categorias = [
    { slug: 'emprende', nombre: 'Emprendimiento' },
    { slug: 'entrevista', nombre: 'Entrevistes' },
    { slug: 'espacios', nombre: 'Espacios' },
    { slug: 'strate', nombre: 'Estrategia' },
    { slug: 'lider', nombre: 'Lideratge' },
    { slug: 'live', nombre: 'Live' },
    { slug: 'networking', nombre: 'Networking' },
    { slug: 'radio', nombre: 'Ràdio' },
    { slug: 'recursos', nombre: 'Recursos' },
    { slug: 'tecno', nombre: 'Tecnología' },
  ];

  const { data: existente } = await supabase
    .from('medios')
    .select('id, slug, api_user, api_password')
    .eq('slug', 'femnegoci')
    .maybeSingle();

  const payload = {
    nombre: 'Fem Negoci',
    slug: 'femnegoci',
    color: 'violet',
    prompt_personalidad: prompt,
    url_wordpress: 'https://femnegoci.es',
    email_pop_user: 'panel@femnegoci.es',
    email_pop_password: 'Montjuic123!',
    email_pop_host: 'pop3.servidor-correo.net',
    email_pop_port: 110,
    email_pop_secure: false,
    categorias_json: categorias,
  };

  if (existente) {
    const { data, error } = await supabase
      .from('medios')
      .update(payload)
      .eq('id', existente.id)
      .select('id, nombre, slug, email_pop_user, url_wordpress, api_user')
      .single();

    if (error) throw new Error(error.message);
    console.log(`Medio actualizado #${data.id}: ${data.nombre} (${data.slug})`);
    console.log(`  Buzón: ${data.email_pop_user}`);
    console.log(`  WP: ${data.url_wordpress} · usuario: ${data.api_user || '(pendiente)'}`);
    return;
  }

  const { data, error } = await supabase
    .from('medios')
    .insert({
      ...payload,
      api_user: 'PENDIENTE_USUARIO_WP',
      api_password: 'PENDIENTE_PASSWORD_WP',
    })
    .select('id, nombre, slug, email_pop_user, url_wordpress')
    .single();

  if (error) throw new Error(error.message);

  console.log(`Medio creado #${data.id}: ${data.nombre} (${data.slug})`);
  console.log(`  Buzón: ${data.email_pop_user}`);
  console.log(`  WP: ${data.url_wordpress}`);
  console.log('');
  console.log('  ⚠️  Falta configurar api_user y api_password en Supabase para publicar en WordPress.');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
