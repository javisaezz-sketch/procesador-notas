require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

function ruta(url) {
  const m = url.match(/notas-prensa\/(.+?)(\?|$)/);
  return m ? decodeURIComponent(m[1]) : null;
}

(async () => {
  const s = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );

  for (const id of [52, 92, 82, 69]) {
    const { data: a } = await s
      .from('articulos')
      .select('imagen_destacada_url, imagenes_publicar_urls')
      .eq('id', id)
      .single();

    const url = a.imagen_destacada_url;
    const path = ruta(url);
    let ok = 'n/a';
    if (path) {
      const { error } = await s.storage.from('notas-prensa').download(path);
      ok = error ? `FAIL: ${error.message}` : 'OK';
    }

    console.log(`art ${id}: path=${path?.slice(0, 40)} download=${ok}`);
    console.log(`  url=${url?.slice(0, 80)}...`);
  }
})().catch(console.error);
