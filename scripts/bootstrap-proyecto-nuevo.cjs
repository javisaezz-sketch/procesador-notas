require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { anadirReglasTituloAlPrompt } = require('../lib/reglasTitulo.cjs');

function leerPrompt(archivo) {
  const ruta = path.join(__dirname, '..', archivo);
  if (fs.existsSync(ruta)) {
    return fs.readFileSync(ruta, 'utf8');
  }
  return null;
}

function promptGenerico(nombre) {
  return anadirReglasTituloAlPrompt(
    `Actúa como redactor jefe de ${nombre}. Transforma notas de prensa en artículos periodísticos completos en HTML dentro de <article>, sin <h1> en el cuerpo.`,
  );
}

async function main() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const wpUser = process.env.WP_API_USER?.trim();
  const wpPass = process.env.WP_API_PASSWORD?.trim();

  if (!url || !key) {
    throw new Error('Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env');
  }

  if (!wpUser || !wpPass) {
    throw new Error(
      'Añade WP_API_USER y WP_API_PASSWORD al .env (usuario/contraseña de aplicación WordPress, igual para los 4 medios).',
    );
  }

  const supabase = createClient(url, key);

  const { error: pingError } = await supabase.from('medios').select('id').limit(1);
  if (pingError) {
    throw new Error(
      `No hay tablas. Ejecuta primero supabase-proyecto-nuevo.sql en el SQL Editor: ${pingError.message}`,
    );
  }

  const pop = {
    email_pop_host: 'pop3.servidor-correo.net',
    email_pop_port: 110,
    email_pop_secure: false,
    email_pop_password: process.env.EMAIL_POP_PASSWORD?.trim() || 'Montjuic123!',
  };

  const medios = [
    {
      nombre: 'Travelicius',
      slug: 'travelicius',
      color: 'indigo',
      url_wordpress: 'https://travelicius.es',
      email_pop_user: 'panel@travelicius.es',
      prompt_personalidad: leerPrompt('prompt-travelicius.txt') || promptGenerico('Travelicius'),
      categorias_json: [
        { slug: 'negocio', nombre: 'Business & Strategy' },
        { slug: 'gastro', nombre: 'Gastro & Gourmet' },
        { slug: 'hotels', nombre: 'Hospitality & Hotels' },
        { slug: 'ibiza', nombre: 'Ibiza' },
      ],
    },
    {
      nombre: 'Vida&Style',
      slug: 'vidaystyle',
      color: 'emerald',
      url_wordpress: 'https://vidaystyle.com',
      email_pop_user: 'panel@vidaystyle.com',
      prompt_personalidad: promptGenerico('Vida&Style'),
      categorias_json: [
        { slug: 'musica', nombre: 'Cultura' },
        { slug: 'familia', nombre: 'Family&Planes' },
        { slug: 'design', nombre: 'Home&Design' },
        { slug: 'nightlife-clubbing', nombre: 'Nightlife & Clubbing' },
        { slug: 'motor', nombre: 'Tech&Motor' },
        { slug: 'travel', nombre: 'Travel' },
        { slug: 'wellness', nombre: 'Wellness&Mindset' },
      ],
    },
    {
      nombre: 'Glamcloset',
      slug: 'glamcloset',
      color: 'rose',
      url_wordpress: 'https://glamcloset.cat',
      email_pop_user: 'panel@glamcloset.cat',
      prompt_personalidad: promptGenerico('Glamcloset'),
      categorias_json: [
        { slug: 'iconic-style', nombre: 'Iconic Style' },
        { slug: 'glam', nombre: 'La Glam' },
        { slug: 'radio', nombre: 'Radio' },
        { slug: 'skincare-beauty', nombre: 'Skincare & Beauty' },
        { slug: 'smart-shopping', nombre: 'Smart Shopping' },
        { slug: 'styling-guide', nombre: 'Styling Guide' },
        { slug: 'trend-report', nombre: 'Trend Report' },
      ],
    },
    {
      nombre: 'Fem Negoci',
      slug: 'femnegoci',
      color: 'violet',
      url_wordpress: 'https://femnegoci.es',
      email_pop_user: 'panel@femnegoci.es',
      prompt_personalidad: leerPrompt('prompt-femnegoci.txt') || promptGenerico('Fem Negoci'),
      categorias_json: [
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
      ],
    },
  ];

  for (const medio of medios) {
    const payload = {
      ...medio,
      ...pop,
      api_user: wpUser,
      api_password: wpPass,
    };

    const { data: existente } = await supabase
      .from('medios')
      .select('id')
      .eq('slug', medio.slug)
      .maybeSingle();

    if (existente) {
      const { error } = await supabase.from('medios').update(payload).eq('id', existente.id);
      if (error) throw new Error(`${medio.slug}: ${error.message}`);
      console.log(`✅ Actualizado: ${medio.slug}`);
    } else {
      const { error } = await supabase.from('medios').insert(payload);
      if (error) throw new Error(`${medio.slug}: ${error.message}`);
      console.log(`✅ Creado: ${medio.slug}`);
    }
  }

  console.log('\nMedios listos. Siguiente:');
  console.log('  1. GitHub → Settings → Secrets → actualiza SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  console.log('  2. Vercel → panel-editorial → Environment Variables (las mismas 3)');
  console.log('  3. npm run verificar-supabase');
  console.log('  4. GitHub Actions → Pipeline emails → Run workflow');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
