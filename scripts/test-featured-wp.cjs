require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function download(admin, url) {
  const marker = '/object/public/notas-prensa/';
  let path = null;
  const i = url.indexOf(marker);
  if (i >= 0) {
    path = decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
  }
  const sign = '/object/sign/notas-prensa/';
  const si = url.indexOf(sign);
  if (!path && si >= 0) {
    path = decodeURIComponent(url.slice(si + sign.length).split('?')[0]);
  }
  const { data, error } = await admin.storage.from('notas-prensa').download(path);
  if (error) throw new Error(error.message);
  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || 'image/jpeg',
  };
}

async function test(slug, artId) {
  const s = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );

  const { data: medio } = await s.from('medios').select('*').eq('slug', slug).single();
  const { data: articulo } = await s
    .from('articulos')
    .select('imagen_destacada_url')
    .eq('id', artId)
    .single();

  const auth = `Basic ${Buffer.from(
    `${medio.api_user}:${medio.api_password.replace(/\s+/g, '')}`,
  ).toString('base64')}`;
  const base = medio.url_wordpress.replace(/\/+$/, '');

  const { buffer, contentType } = await download(s, articulo.imagen_destacada_url);

  const up = await fetch(`${base}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': contentType,
      'Content-Disposition': 'attachment; filename="test-destacada.jpg"',
      Accept: 'application/json',
    },
    body: buffer,
  });
  const media = await up.json();
  console.log(`${slug} upload:`, up.status, 'mediaId:', media.id, media.message || '');

  const postRes = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      title: `TEST featured ${Date.now()}`,
      content: '<p>test</p>',
      status: 'draft',
      featured_media: media.id,
    }),
  });
  const post = await postRes.json();
  console.log(`${slug} post:`, postRes.status, 'featured:', post.featured_media, 'postId:', post.id);
}

(async () => {
  await test('glamcloset', 90);
  await test('vidaystyle', 69);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
