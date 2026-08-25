/**
 * Comprueba REST featured_media en los 4 WordPress del panel.
 * Uso: node scripts/verificar-imagen-destacada-medios.cjs
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const MEDIOS_WORDPRESS = ['glamcloset', 'travelicius', 'vidaystyle', 'femnegoci'];

function normalizarUrlWordPress(url) {
  return url.trim().replace(/\/+$/, '');
}

function crearAuthHeader(medio) {
  const credentials = Buffer.from(
    `${medio.api_user}:${medio.api_password.replace(/\s+/g, '')}`,
  ).toString('base64');
  return `Basic ${credentials}`;
}

async function diagnosticarFeatured(medio) {
  const base = normalizarUrlWordPress(medio.url_wordpress);
  const headers = {
    Authorization: crearAuthHeader(medio),
    Accept: 'application/json',
  };

  const me = await fetch(`${base}/wp-json/wp/v2/users/me?context=edit`, { headers });
  if (!me.ok) {
    const body = await me.text();
    throw new Error(`Auth fallida (${me.status}): ${body.slice(0, 200)}`);
  }

  const posts = await fetch(`${base}/wp-json/wp/v2/posts?per_page=1&context=edit`, { headers });
  const postsBody = await posts.json().catch(() => null);

  if (!posts.ok) {
    throw new Error(`No se pudieron leer posts (${posts.status})`);
  }

  const ejemplo = Array.isArray(postsBody) ? postsBody[0] : null;

  return {
    soportaFeaturedMedia: Boolean(ejemplo && 'featured_media' in ejemplo),
    ejemploPostId: ejemplo?.id ?? null,
    ejemploFeaturedMedia: ejemplo?.featured_media ?? null,
  };
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env');
  }

  const supabase = createClient(url, key);
  const { data: medios, error } = await supabase
    .from('medios')
    .select('id, nombre, slug, url_wordpress, api_user, api_password')
    .in('slug', MEDIOS_WORDPRESS);

  if (error) {
    throw new Error(error.message);
  }

  const porSlug = Object.fromEntries((medios ?? []).map((medio) => [medio.slug, medio]));
  let fallos = 0;

  for (const slug of MEDIOS_WORDPRESS) {
    const medio = porSlug[slug];

    if (!medio) {
      console.log(`✗ ${slug}: no existe en Supabase`);
      fallos += 1;
      continue;
    }

    if (!medio.url_wordpress || !medio.api_user || !medio.api_password) {
      console.log(`✗ ${medio.nombre}: faltan credenciales WordPress`);
      fallos += 1;
      continue;
    }

    try {
      const diag = await diagnosticarFeatured(medio);
      const ok = diag.soportaFeaturedMedia !== false;

      console.log(
        `${ok ? '✓' : '⚠'} ${medio.nombre} (${slug})`,
        '- REST featured_media:',
        diag.soportaFeaturedMedia ? 'sí' : 'no detectado',
        diag.ejemploPostId ? `(post #${diag.ejemploPostId})` : '',
      );

      if (!ok) {
        fallos += 1;
        console.log(
          `  → Añade wordpress-imagen-destacada-rest.php al functions.php de ${medio.url_wordpress}`,
        );
      }
    } catch (err) {
      fallos += 1;
      console.log(`✗ ${medio.nombre} (${slug}): ${err.message}`);
    }
  }

  if (fallos) {
    process.exit(1);
  }

  console.log('\nLos 4 medios WordPress responden correctamente.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
