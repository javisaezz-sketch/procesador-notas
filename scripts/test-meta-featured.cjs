require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function test(slug) {
  const s = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );
  const { data: medio } = await s.from('medios').select('*').eq('slug', slug).single();
  const auth = `Basic ${Buffer.from(
    `${medio.api_user}:${medio.api_password.replace(/\s+/g, '')}`,
  ).toString('base64')}`;
  const base = medio.url_wordpress.replace(/\/+$/, '');

  const metaKeys = {
    glamcloset: '_gc_target_email',
    vidaystyle: '_vs_target_emails',
  };

  // upload tiny media via existing
  const up = await fetch(`${base}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'image/jpeg',
      'Content-Disposition': 'attachment; filename="t.jpg"',
    },
    body: Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=', 'base64'),
  });
  const media = await up.json();

  const body = {
    title: `TEST meta+featured ${Date.now()}`,
    content: '<p>t</p>',
    status: 'draft',
    featured_media: media.id,
    meta: { [metaKeys[slug]]: 'test@example.com' },
  };

  const postRes = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const post = await postRes.json();
  console.log(`${slug}: status=${postRes.status} featured=${post.featured_media} id=${post.id}`);
}

(async () => {
  await test('glamcloset');
  await test('vidaystyle');
})().catch(console.error);
