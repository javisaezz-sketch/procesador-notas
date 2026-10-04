import { GoogleGenerativeAI } from '@google/generative-ai';
import { createSupabaseClient } from './supabase';
import { HASHTAGS_OFICIALES_LAGLAM } from './instagram.js';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

function textoPlano(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, 3500);
}

export async function generarBorradorLaGlamDesdeArticulo(articulo, medioOrigen) {
  if (!articulo?.id || medioOrigen?.slug === 'laglam') {
    return { creado: false, motivo: 'origen_instagram' };
  }

  if (!articulo.imagen_destacada_url) {
    return { creado: false, motivo: 'sin_imagen' };
  }

  const supabase = createSupabaseClient();
  const { data: laglam, error: medioErr } = await supabase
    .from('medios')
    .select('id, slug, prompt_personalidad')
    .eq('slug', 'laglam')
    .maybeSingle();

  if (medioErr || !laglam?.prompt_personalidad) {
    return { creado: false, motivo: 'sin_laglam' };
  }

  if (articulo.nota_prensa_id) {
    const { data: existente } = await supabase
      .from('articulos')
      .select('id')
      .eq('nota_prensa_id', articulo.nota_prensa_id)
      .eq('medio_id', laglam.id)
      .in('estado', ['pendiente_revision', 'programado', 'publicado'])
      .limit(1)
      .maybeSingle();

    if (existente) {
      return { creado: false, motivo: 'ya_existe', articuloId: existente.id };
    }
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: laglam.prompt_personalidad,
  });

  const hashtags = HASHTAGS_OFICIALES_LAGLAM.join(' ');
  const prompt = `
Convierte este artículo ya aprobado en un pie de foto para Instagram de @laglamdelbuenvivir.
No lo publiques: es un borrador para el panel.

Medio de origen: ${medioOrigen?.nombre || 'web'}
Titular: ${articulo.titulo_generado || ''}
Texto:
${textoPlano(articulo.contenido_generado)}

Reglas:
- Tono cercano, chic y sensorial. Párrafos cortos en <p>.
- Primera línea con gancho.
- Cierra con una pregunta.
- Termina con estos hashtags: ${hashtags}
- Responde solo JSON: {"titulo_generado":"...","contenido_generado":"<p>...</p>"}
`.trim();

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const jsonMatch = raw.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini no devolvió el borrador de Instagram');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.titulo_generado || !parsed.contenido_generado) {
    throw new Error('Faltan titulo o contenido en el borrador de Instagram');
  }

  let contenido = String(parsed.contenido_generado).trim();
  if (!HASHTAGS_OFICIALES_LAGLAM.every((tag) => contenido.includes(tag))) {
    contenido = `${contenido}<p>${hashtags}</p>`;
  }

  const fotos = articulo.imagen_destacada_url ? [articulo.imagen_destacada_url] : [];
  const payload = {
    nota_prensa_id: articulo.nota_prensa_id,
    medio_id: laglam.id,
    articulo_origen_id: articulo.id,
    titulo_generado: String(parsed.titulo_generado).trim(),
    contenido_generado: contenido,
    imagen_destacada_url: articulo.imagen_destacada_url,
    imagenes_publicar_urls: fotos,
    estado: 'pendiente_revision',
    wp_post_status: 'draft',
    fecha_evento: articulo.fecha_evento || null,
  };

  let { data: creado, error: insertErr } = await supabase
    .from('articulos')
    .insert(payload)
    .select('id, titulo_generado')
    .single();

  if (insertErr && /articulo_origen_id|fecha_evento/.test(insertErr.message || '')) {
    delete payload.articulo_origen_id;
    delete payload.fecha_evento;
    ({ data: creado, error: insertErr } = await supabase
      .from('articulos')
      .insert(payload)
      .select('id, titulo_generado')
      .single());
  }

  if (insertErr) {
    throw new Error(insertErr.message);
  }

  return { creado: true, articuloId: creado.id, titulo: creado.titulo_generado };
}
