require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkWp(medio, wpIds) {
  const auth = `Basic ${Buffer.from(
    `${medio.api_user}:${medio.api_password.replace(/\s+/g, '')}`,
  ).toString('base64')}`;
  const base = medio.url_wordpress.replace(/\/+$/, '');

  for (const id of wpIds) {
    const res = await fetch(`${base}/wp-json/wp/v2/posts/${id}?context=edit`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    const post = await res.json();
    console.log(`${medio.slug} wp ${id}: featured=${post.featured_media} status=${post.status}`);
  }
}

(async () => {
  const s = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );

  const { data: medios } = await s.from('medios').select('*').in('slug', ['glamcloset', 'vidaystyle']);

  for (const medio of medios ?? []) {
    const { data: arts } = await s
      .from('articulos')
      .select('id, wp_post_id, imagen_destacada_url, imagenes_publicar_urls, estado')
      .eq('medio_id', medio.id)
      .not('wp_post_id', 'is', null)
      .order('id', { ascending: false })
      .limit(10);

    console.log(`\n--- ${medio.slug} ---`);
    for (const a of arts ?? []) {
      console.log(`art ${a.id} wp ${a.wp_post_id} pub=${Array.isArray(a.imagenes_publicar_urls) ? a.imagenes_publicar_urls.length : 'null'}`);
    }

    await checkWp(
      medio,
      (arts ?? []).map((a) => a.wp_post_id).filter(Boolean),
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
