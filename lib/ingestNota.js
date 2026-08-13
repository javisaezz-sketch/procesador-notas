import { createClient } from '@supabase/supabase-js';

const BUCKET = 'notas-prensa';

export function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_ANON_KEY).',
    );
  }

  return createClient(url, key);
}

function limpiarTexto(texto) {
  return (texto || '').replace(/\r\n/g, '\n').trim();
}

function esImagen(contentType = '', filename = '') {
  if (contentType.startsWith('image/')) return true;
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);
}

export async function subirImagenNota(supabase, notaId, archivo) {
  const extension = archivo.filename?.split('.').pop() || 'jpg';
  const path = `${notaId}/${Date.now()}-${archivo.filename || `imagen.${extension}`}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, archivo.buffer, {
      contentType: archivo.contentType || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Error al subir imagen: ${uploadError.message}`);
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: insertError } = await supabase
    .from('notas_prensa_imagenes')
    .insert({
      nota_prensa_id: notaId,
      url: publicData.publicUrl,
      nombre_archivo: archivo.filename || path,
      origen: archivo.origen || 'adjunto',
    });

  if (insertError) {
    throw new Error(`Error al guardar imagen en BD: ${insertError.message}`);
  }

  return publicData.publicUrl;
}

export async function guardarNotaDesdeEmail({
  remitente,
  asunto,
  texto,
  html,
  imagenes = [],
  messageId,
  medioId = null,
}) {
  const supabase = createSupabaseAdmin();

  if (messageId) {
    const { data: existente } = await supabase
      .from('notas_prensa')
      .select('id, asunto, remitente, estado')
      .eq('email_message_id', messageId)
      .maybeSingle();

    if (existente) {
      return { nota: existente, imagenes: [], duplicado: true };
    }
  }

  const contenidoOriginal = limpiarTexto(texto) || limpiarTexto(html) || 'Sin contenido';

  const { data: nota, error } = await supabase
    .from('notas_prensa')
    .insert({
      remitente: remitente || null,
      asunto: asunto || null,
      contenido_original: contenidoOriginal,
      contenido_html: html || null,
      estado: 'recibida',
      email_message_id: messageId || null,
      fecha_recepcion: new Date().toISOString(),
      medio_id: medioId || null,
    })
    .select('id, asunto, remitente, estado')
    .single();

  if (error) {
    throw new Error(`Error al crear nota_prensa: ${error.message}`);
  }

  const urlsImagenes = await guardarImagenesDelEmail(supabase, nota.id, {
    imagenes,
    html,
  });

  return {
    nota,
    imagenes: urlsImagenes,
  };
}

export function extraerImagenesDeMailparser(parsed) {
  const imagenes = [];

  for (const attachment of parsed.attachments || []) {
    if (!attachment.content) continue;

    const filename = attachment.filename || attachment.cid || 'adjunto.jpg';
    if (!esImagen(attachment.contentType, filename)) continue;

    imagenes.push({
      filename: attachment.filename || `${attachment.cid || 'inline'}.jpg`,
      contentType: attachment.contentType,
      buffer: attachment.content,
      origen:
        attachment.contentDisposition?.toLowerCase?.().includes('inline') ||
        attachment.related
          ? 'inline'
          : 'adjunto',
    });
  }

  return imagenes;
}

export async function guardarImagenesDelEmail(supabase, notaId, { imagenes = [], html }) {
  const urlsImagenes = [];

  for (const imagen of imagenes.filter((img) =>
    esImagen(img.contentType, img.filename),
  )) {
    const url = await subirImagenNota(supabase, notaId, imagen);
    urlsImagenes.push(url);
  }

  if (html) {
    const { guardarImagenesDesdeHtml } = await import('./extraerImagenesEmail.js');
    const desdeHtml = await guardarImagenesDesdeHtml(supabase, notaId, html);
    urlsImagenes.push(...desdeHtml);
  }

  return urlsImagenes;
}
