import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import {
  buscarNotaDuplicada,
  extraerUrlsDeTexto,
} from './detectarDuplicadoNota.js';
import { normalizeSupabaseUrl } from './normalizeSupabaseUrl.js';

const BUCKET = 'notas-prensa';

export function createSupabaseAdmin() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_ANON_KEY).',
    );
  }

  const options =
    typeof globalThis.WebSocket === 'undefined'
      ? {
          realtime: {
            transport: WebSocket,
          },
        }
      : {};

  return createClient(url, key, options);
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
      return {
        nota: existente,
        imagenes: [],
        duplicado: true,
        motivoDuplicado: 'message_id',
      };
    }
  }

  let contenidoTexto = limpiarTexto(texto);
  let contenidoHtml = html || null;
  let asuntoFinal = asunto || null;
  let imagenesFinales = [...imagenes];
  let urlLeida = null;
  let omitirImagenesHtml = false;

  const tieneAdjuntos = imagenes.some((imagen) =>
    esImagen(imagen.contentType, imagen.filename),
  );

  const { esEmailSoloEnlace, esAsuntoGenerico, extraerContenidoDesdeUrl } =
    await import('./extraerContenidoUrl.js');

  const urlDetectadaTemprana = esEmailSoloEnlace(contenidoTexto, contenidoHtml, {
    tieneAdjuntos,
  });

  if (urlDetectadaTemprana && medioId) {
    const duplicadoTemprano = await buscarNotaDuplicada(supabase, {
      medioId,
      urls: [urlDetectadaTemprana],
      contenidoOriginal: `Fuente: ${urlDetectadaTemprana}`,
    });

    if (duplicadoTemprano) {
      return {
        nota: duplicadoTemprano.nota,
        imagenes: [],
        duplicado: true,
        motivoDuplicado: duplicadoTemprano.motivo,
      };
    }
  }

  try {
    const urlDetectada = urlDetectadaTemprana;

    if (urlDetectada) {
      const extraido = await extraerContenidoDesdeUrl(urlDetectada);
      urlLeida = extraido.url;
      contenidoTexto = extraido.texto;
      contenidoHtml = extraido.html;

      if (!asuntoFinal?.trim() || esAsuntoGenerico(asuntoFinal)) {
        asuntoFinal =
          extraido.titulo ||
          extraido.texto?.split('\n').map((linea) => linea.trim()).find(Boolean) ||
          asuntoFinal;
      }

      if (extraido.imagenesDescargadas?.length) {
        imagenesFinales = extraido.imagenesDescargadas;
        omitirImagenesHtml = true;
      } else if (extraido.imagen) {
        imagenesFinales = [extraido.imagen];
        omitirImagenesHtml = true;
      } else if (extraido.candidatasImagen?.length) {
        const { descargarMejoresImagenesRemotas } = await import(
          './extraerImagenesEmail.js'
        );
        imagenesFinales = await descargarMejoresImagenesRemotas(
          extraido.candidatasImagen,
          { max: 3, prefijo: 'url' },
        );
        omitirImagenesHtml = imagenesFinales.length > 0;
      }
    }
  } catch (error) {
    console.warn(
      `[ingestNota] No se pudo leer enlace: ${error.message}`,
    );
  }

  const contenidoOriginal =
    contenidoTexto || limpiarTexto(contenidoHtml) || 'Sin contenido';

  const duplicadoFinal = await buscarNotaDuplicada(supabase, {
    medioId,
    asunto: asuntoFinal,
    contenidoOriginal,
    urls: extraerUrlsDeTexto(texto, html),
  });

  if (duplicadoFinal) {
    return {
      nota: duplicadoFinal.nota,
      imagenes: [],
      duplicado: true,
      motivoDuplicado: duplicadoFinal.motivo,
    };
  }

  const { data: nota, error } = await supabase
    .from('notas_prensa')
    .insert({
      remitente: urlLeida ? 'panel@url-ingest' : remitente || null,
      asunto: asuntoFinal || null,
      contenido_original: contenidoOriginal,
      contenido_html: contenidoHtml || null,
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
    imagenes: imagenesFinales,
    html: contenidoHtml,
    omitirImagenesHtml,
  });

  return {
    nota,
    imagenes: urlsImagenes,
    urlLeida,
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

export async function guardarImagenesDelEmail(
  supabase,
  notaId,
  { imagenes = [], html, omitirImagenesHtml = false },
) {
  const urlsImagenes = [];

  for (const imagen of imagenes.filter((img) =>
    esImagen(img.contentType, img.filename),
  )) {
    const url = await subirImagenNota(supabase, notaId, imagen);
    urlsImagenes.push(url);
  }

  if (html && !omitirImagenesHtml) {
    const { guardarImagenesDesdeHtml } = await import('./extraerImagenesEmail.js');
    const desdeHtml = await guardarImagenesDesdeHtml(supabase, notaId, html);
    urlsImagenes.push(...desdeHtml);
  }

  return urlsImagenes;
}
