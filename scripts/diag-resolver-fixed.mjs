import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolverImagenesParaArticulo } from '../lib/imagenes.js';

dotenv.config();

const s = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
);

for (const id of [69, 90, 75]) {
  const { data: a } = await s
    .from('articulos')
    .select('*')
    .eq('id', id)
    .single();

  const r = await resolverImagenesParaArticulo(s, {
    notaPrensaId: a.nota_prensa_id,
    medioId: a.medio_id,
    imagenDestacadaUrl: a.imagen_destacada_url,
    imagenesPublicarUrls: a.imagenes_publicar_urls,
  });

  console.log({
    id,
    publicar: Array.isArray(a.imagenes_publicar_urls)
      ? a.imagenes_publicar_urls.length
      : a.imagenes_publicar_urls,
    destacada: r.destacadaUrl ? 'SI' : 'NO',
  });
}
