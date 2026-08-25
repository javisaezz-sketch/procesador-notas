require('dotenv').config();

async function main() {
  const { createClient } = require('@supabase/supabase-js');
  const {
    resolverUrlsSeleccionadas,
    resolverUrlDestacada,
    mismaImagenStorage,
  } = require('../lib/limpiarAlmacenNota.js');

  const s = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );

  const ids = [90, 69, 92, 82, 52, 75, 67, 73];

  for (const id of ids) {
    const { data: a } = await s
      .from('articulos')
      .select('id, medio_id, nota_prensa_id, imagen_destacada_url, imagenes_publicar_urls')
      .eq('id', id)
      .single();

    const { data: imgs } = await s
      .from('notas_prensa_imagenes')
      .select('url')
      .eq('nota_prensa_id', a.nota_prensa_id);

    const urlsDisponibles = (imgs ?? []).map((i) => i.url).filter(Boolean);
    const publicar = a.imagenes_publicar_urls;

    let destacadaUrl = null;
    let adicionalesUrls = [];

    if (Array.isArray(publicar)) {
      const seleccionadas = resolverUrlsSeleccionadas(publicar, urlsDisponibles);
      if (seleccionadas.length) {
        destacadaUrl = resolverUrlDestacada(
          a.imagen_destacada_url,
          seleccionadas,
          urlsDisponibles,
        );
        adicionalesUrls = seleccionadas.filter(
          (url) => !destacadaUrl || !mismaImagenStorage(url, destacadaUrl),
        );
      }
    } else {
      destacadaUrl = null;
    }

    console.log({
      id,
      imgsNota: urlsDisponibles.length,
      publicar: Array.isArray(publicar) ? publicar.length : publicar,
      destacadaDb: a.imagen_destacada_url ? 'SI' : 'NO',
      resolverDestacada: destacadaUrl ? 'SI' : 'NO',
      adicionales: adicionalesUrls.length,
    });
  }
}

main().catch(console.error);
