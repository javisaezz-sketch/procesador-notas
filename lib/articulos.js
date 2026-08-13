import { createSupabaseClient } from './supabase';
import { eliminarEmailNotaDesdeArticulo } from './eliminarEmailNota.js';
import { listarImagenesDeNota } from './imagenes';

function normalizarUrlsPublicar(urls) {
  if (!Array.isArray(urls)) {
    throw new Error('imagenes_publicar_urls debe ser un array de URLs');
  }

  return [...new Set(urls.map((url) => String(url).trim()).filter(Boolean))];
}

function columnaImagenesPublicarDisponible(error) {
  return !String(error?.message ?? '').includes('imagenes_publicar_urls');
}

export async function getImagenesArticulo(articuloId) {
  const supabase = createSupabaseClient();

  let { data: articulo, error } = await supabase
    .from('articulos')
    .select(
      'id, estado, nota_prensa_id, imagen_destacada_url, imagenes_publicar_urls',
    )
    .eq('id', articuloId)
    .single();

  if (error && !columnaImagenesPublicarDisponible(error)) {
    const fallback = await supabase
      .from('articulos')
      .select('id, estado, nota_prensa_id, imagen_destacada_url')
      .eq('id', articuloId)
      .single();

    articulo = fallback.data ? { ...fallback.data, imagenes_publicar_urls: null } : null;
    error = fallback.error;
  }

  if (error || !articulo) {
    throw new Error('Artículo no encontrado');
  }

  const { data: nota } = await supabase
    .from('notas_prensa')
    .select('contenido_html')
    .eq('id', articulo.nota_prensa_id)
    .maybeSingle();

  const imagenes = await listarImagenesDeNota(supabase, articulo.nota_prensa_id, {
    contenidoHtml: nota?.contenido_html,
  });

  const urlsDisponibles = imagenes.map((imagen) => imagen.url).filter(Boolean);
  const publicarUrls = Array.isArray(articulo.imagenes_publicar_urls)
    ? articulo.imagenes_publicar_urls.filter((url) => urlsDisponibles.includes(url))
    : urlsDisponibles;

  const destacadaUrl =
    articulo.imagen_destacada_url &&
    publicarUrls.includes(articulo.imagen_destacada_url)
      ? articulo.imagen_destacada_url
      : publicarUrls[0] ?? null;

  return {
    imagenes,
    imagen_destacada_url: destacadaUrl,
    imagenes_publicar_urls: publicarUrls,
  };
}

export async function actualizarArticulo(articuloId, cambios) {
  const supabase = createSupabaseClient();
  const payload = {};

  if (typeof cambios.titulo_generado === 'string') {
    const titulo = cambios.titulo_generado.trim();
    if (!titulo) {
      throw new Error('El título no puede estar vacío');
    }
    payload.titulo_generado = titulo;
  }

  if (typeof cambios.contenido_generado === 'string') {
    const contenido = cambios.contenido_generado.trim();
    if (!contenido) {
      throw new Error('El contenido no puede estar vacío');
    }
    payload.contenido_generado = contenido;
  }

  if (cambios.imagen_destacada_url !== undefined) {
    payload.imagen_destacada_url = cambios.imagen_destacada_url
      ? String(cambios.imagen_destacada_url).trim()
      : null;
  }

  if (cambios.imagenes_publicar_urls !== undefined) {
    payload.imagenes_publicar_urls = normalizarUrlsPublicar(
      cambios.imagenes_publicar_urls,
    );
  }

  if (cambios.email_notificacion !== undefined) {
    const email = String(cambios.email_notificacion ?? '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('El email de notificación no es válido');
    }
    payload.email_notificacion = email || null;
  }

  if (!Object.keys(payload).length) {
    throw new Error('No hay cambios que guardar');
  }

  const { data: articulo, error: readError } = await supabase
    .from('articulos')
    .select('id, estado, nota_prensa_id')
    .eq('id', articuloId)
    .single();

  if (readError || !articulo) {
    throw new Error('Artículo no encontrado');
  }

  if (articulo.estado !== 'pendiente_revision') {
    throw new Error('Este artículo ya no está pendiente de revisión');
  }

  if (
    payload.imagen_destacada_url &&
    payload.imagenes_publicar_urls &&
    !payload.imagenes_publicar_urls.includes(payload.imagen_destacada_url)
  ) {
    throw new Error('La imagen destacada debe estar incluida en las imágenes a publicar');
  }

  if (
    payload.imagen_destacada_url &&
    !payload.imagenes_publicar_urls &&
    cambios.imagenes_publicar_urls === undefined
  ) {
    const { data: actual } = await supabase
      .from('articulos')
      .select('imagenes_publicar_urls')
      .eq('id', articuloId)
      .single();

    const publicar = actual?.imagenes_publicar_urls;
    if (Array.isArray(publicar) && publicar.length && !publicar.includes(payload.imagen_destacada_url)) {
      throw new Error('La imagen destacada debe estar incluida en las imágenes a publicar');
    }
  }

  const { data, error } = await supabase
    .from('articulos')
    .update(payload)
    .eq('id', articuloId)
    .eq('estado', 'pendiente_revision')
    .select(
      'id, titulo_generado, contenido_generado, imagen_destacada_url, imagenes_publicar_urls, email_notificacion, estado, fecha_creacion',
    )
    .single();

  if (error && !columnaImagenesPublicarDisponible(error) && payload.imagenes_publicar_urls !== undefined) {
    const { imagenes_publicar_urls, ...payloadSinGaleria } = payload;

    const retry = await supabase
      .from('articulos')
      .update(payloadSinGaleria)
      .eq('id', articuloId)
      .eq('estado', 'pendiente_revision')
      .select(
        'id, titulo_generado, contenido_generado, imagen_destacada_url, estado, fecha_creacion',
      )
      .single();

    if (retry.error) {
      throw new Error(`No se pudo guardar el artículo: ${retry.error.message}`);
    }

    return {
      ...retry.data,
      imagenes_publicar_urls: imagenes_publicar_urls ?? null,
    };
  }

  if (error) {
    throw new Error(`No se pudo guardar el artículo: ${error.message}`);
  }

  return data;
}

export async function anularArticulo(articuloId) {
  const supabase = createSupabaseClient();

  const { data: articulo, error: readError } = await supabase
    .from('articulos')
    .select('id, titulo_generado, estado')
    .eq('id', articuloId)
    .single();

  if (readError || !articulo) {
    throw new Error('Artículo no encontrado');
  }

  if (articulo.estado !== 'pendiente_revision') {
    throw new Error('Este artículo ya no está pendiente de revisión');
  }

  const { data, error } = await supabase
    .from('articulos')
    .update({ estado: 'anulado' })
    .eq('id', articuloId)
    .eq('estado', 'pendiente_revision')
    .select('id, estado, titulo_generado')
    .single();

  if (error) {
    throw new Error(`No se pudo anular el artículo: ${error.message}`);
  }

  let emailBuzon = { eliminado: false, motivo: 'no_intentado' };

  try {
    emailBuzon = await eliminarEmailNotaDesdeArticulo(articuloId);
  } catch (deleteError) {
    emailBuzon = {
      eliminado: false,
      motivo: 'error_buzon',
      error: deleteError.message,
    };
  }

  return { ...data, emailBuzon };
}
