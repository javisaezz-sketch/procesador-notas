require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

(async () => {
  const s = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );

  const { data: medios } = await s.from('medios').select('id, slug, nombre').in('slug', [
    'glamcloset',
    'vidaystyle',
  ]);

  for (const medio of medios ?? []) {
    console.log(`\n=== ${medio.slug} ===`);

    const { data: arts } = await s
      .from('articulos')
      .select(
        'id, titulo_generado, estado, imagen_destacada_url, imagenes_publicar_urls, wp_post_id, wp_post_status',
      )
      .eq('medio_id', medio.id)
      .order('id', { ascending: false })
      .limit(15);

    for (const a of arts ?? []) {
      const pub = Array.isArray(a.imagenes_publicar_urls)
        ? a.imagenes_publicar_urls.length
        : a.imagenes_publicar_urls === null
          ? 'null'
          : typeof a.imagenes_publicar_urls;
      console.log({
        id: a.id,
        estado: a.estado,
        wp: a.wp_post_id,
        destacada: a.imagen_destacada_url ? 'SI' : 'NO',
        publicar: pub,
        titulo: (a.titulo_generado || '').slice(0, 50),
      });
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
