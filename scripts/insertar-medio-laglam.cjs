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
    path.join(__dirname, '../prompt-laglam.txt'),
    'utf8',
  );

  const { data: vidaystyle } = await supabase
    .from('medios')
    .select('email_pop_password')
    .eq('slug', 'vidaystyle')
    .maybeSingle();

  if (!vidaystyle?.email_pop_password) {
    throw new Error('No se pudo encontrar la contraseña de vidaystyle');
  }

  const { data: existente } = await supabase
    .from('medios')
    .select('id, slug')
    .eq('slug', 'laglam')
    .maybeSingle();

  const payload = {
    nombre: 'LaGlam',
    slug: 'laglam',
    color: 'pink',
    prompt_personalidad: prompt,
    url_wordpress: 'https://www.instagram.com/laglamdelbuenvivir',
    email_pop_user: 'laglam@vidaystyle.com',
    email_pop_password: vidaystyle.email_pop_password,
    email_pop_host: 'pop3.servidor-correo.net',
    email_pop_port: 110,
    email_pop_secure: false,
    categorias_json: [{ slug: 'feed', nombre: 'Feed Instagram' }],
    api_user: 'laglamdelbuenvivir',
    api_password: process.env.INSTAGRAM_ACCESS_TOKEN || null,
  };

  if (existente) {
    const { data, error } = await supabase
      .from('medios')
      .update(payload)
      .eq('id', existente.id)
      .select('id, nombre, slug, email_pop_user')
      .single();

    if (error) throw error;
    console.log('Medio LaGlam actualizado con éxito:', data);
  } else {
    const { data, error } = await supabase
      .from('medios')
      .insert(payload)
      .select('id, nombre, slug, email_pop_user')
      .single();

    if (error) throw error;
    console.log('Medio LaGlam insertado con éxito:', data);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
