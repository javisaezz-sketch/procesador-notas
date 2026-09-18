import { createSupabaseClient } from './supabase';
import { eliminarEmailNotaDesdeArticulo } from './eliminarEmailNota.js';
import { createSupabaseAdmin } from './ingestNota.js';
import {
  limpiarRecursosNotaDesdeArticulo,
  mismaImagenStorage,
  urlEnListaImagenes,
  urlsImagenesCuerpo,
  canonicalizarUrlsImagenes,
  resolverUrlDestacada,
} from './limpiarAlmacenNota.js';
import {
  firmarImagenesNota,
  firmarUrlImagenStorage,
} from './urlsImagenStorage.js';
import { listarImagenesDeNota } from './imagenes';
import {
  prepararContenidoConImagenesSeleccionadas,
} from './contenidoHtml.js';

function normalizarUrlsPublicar(urls) {
  if (!Array.isArray(urls)) {
    throw new Error('imagenes_publicar_urls debe ser un array de URLs');
  }

  return [...new Set(urls.map((url) => String(url).trim()).filter(Boolean))];
}

function columnaImagenesPublicarDisponible(error) {
  return !String(error?.message ?? '').includes('imagenes_publicar_urls');
}

function canonicalizarUrlsPublicar(urls, urlsDisponibles) {
  return canonicalizarUrlsImagenes(urls, urlsDisponibles);
}

function sincronizarContenidoConImagenes(html, urlsCuerpo, titulo) {
  return prepararContenidoConImagenesSeleccionadas(html, urlsCuerpo, titulo);
}

export async function getImagenesArticulo(articuloId) {
  const supabase = createSupabaseClient();
  const supabaseAdmin = createSupabaseAdmin();

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

  const imagenes = await listarImagenesDeNota(supabase, articulo.nota_prensa_id);

  const urlsDisponibles = imagenes.map((imagen) => imagen.url).filter(Boolean);
  const publicarUrls = Array.isArray(articulo.imagenes_publicar_urls)
    ? canonicalizarUrlsPublicar(articulo.imagenes_publicar_urls, urlsDisponibles)
    : articulo.imagen_destacada_url
      ? [
          urlsDisponibles.find((url) =>
            mismaImagenStorage(url, articulo.imagen_destacada_url),
          ) ?? articulo.imagen_destacada_url,
        ]
      : [];

  const destacadaUrl = resolverUrlDestacada(
    articulo.imagen_destacada_url,
    publicarUrls,
    urlsDisponibles,
  );

  const imagenesFirmadas = await firmarImagenesNota(supabaseAdmin, imagenes);

  return {
    imagenes: imagenesFirmadas,
    imagen_destacada_url: destacadaUrl
      ? await firmarUrlImagenStorage(supabaseAdmin, destacadaUrl)
      : null,
    imagenes_publicar_urls: await Promise.all(
      publicarUrls.map((url) => firmarUrlImagenStorage(supabaseAdmin, url)),
    ),
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
    .select(
      'id, estado, nota_prensa_id, titulo_generado, contenido_generado, imagen_destacada_url, imagenes_publicar_urls',
    )
    .eq('id', articuloId)
    .single();

  if (readError || !articulo) {
    throw new Error('Artículo no encontrado');
  }

  if (articulo.estado !== 'pendiente_revision') {
    throw new Error('Este artículo ya no está pendiente de revisión');
  }

  const imagenesNota = await listarImagenesDeNota(supabase, articulo.nota_prensa_id);
  const urlsDisponibles = imagenesNota.map((imagen) => imagen.url).filter(Boolean);

  if (payload.imagenes_publicar_urls !== undefined) {
    payload.imagenes_publicar_urls = canonicalizarUrlsPublicar(
      payload.imagenes_publicar_urls,
      urlsDisponibles,
    );
  }

  if (payload.imagen_destacada_url) {
    payload.imagen_destacada_url =
      urlsDisponibles.find((url) =>
        mismaImagenStorage(url, payload.imagen_destacada_url),
      ) ?? payload.imagen_destacada_url;
  }

  const publicarFinal = Array.isArray(payload.imagenes_publicar_urls)
    ? payload.imagenes_publicar_urls
    : Array.isArray(articulo.imagenes_publicar_urls)
      ? canonicalizarUrlsPublicar(articulo.imagenes_publicar_urls, urlsDisponibles)
      : null;

  const destacadaFinal =
    payload.imagen_destacada_url !== undefined
      ? payload.imagen_destacada_url
      : articulo.imagen_destacada_url;

  if (
    Array.isArray(publicarFinal) &&
    publicarFinal.length &&
    !destacadaFinal
  ) {
    payload.imagen_destacada_url = resolverUrlDestacada(
      null,
      publicarFinal,
      urlsDisponibles,
    );
  }

  const destacadaParaValidar =
    payload.imagen_destacada_url !== undefined
      ? payload.imagen_destacada_url
      : destacadaFinal;

  if (
    destacadaParaValidar &&
    Array.isArray(publicarFinal) &&
    publicarFinal.length &&
    !urlEnListaImagenes(destacadaParaValidar, publicarFinal)
  ) {
    throw new Error('La imagen destacada debe estar incluida en las imágenes a publicar');
  }

  const debeSincronizarImagenesEnContenido =
    cambios.imagenes_publicar_urls !== undefined ||
    cambios.imagen_destacada_url !== undefined ||
    cambios.contenido_generado !== undefined;

  const publicarParaSync = Array.isArray(publicarFinal)
    ? publicarFinal
    : Array.isArray(articulo.imagenes_publicar_urls)
      ? canonicalizarUrlsPublicar(articulo.imagenes_publicar_urls, urlsDisponibles)
      : [];

  if (debeSincronizarImagenesEnContenido) {
    const baseContenido =
      payload.contenido_generado !== undefined
        ? payload.contenido_generado
        : articulo.contenido_generado;

    if (typeof baseContenido === 'string' && baseContenido.trim()) {
      const urlsCuerpo = urlsImagenesCuerpo(
        publicarParaSync,
        payload.imagen_destacada_url !== undefined
          ? payload.imagen_destacada_url
          : destacadaParaValidar,
      );

      payload.contenido_generado = sincronizarContenidoConImagenes(
        baseContenido,
        urlsCuerpo,
        payload.titulo_generado ?? articulo.titulo_generado,
      );
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

  if (!['pendiente_revision', 'publicado'].includes(articulo.estado)) {
    throw new Error('Este artículo ya no se puede eliminar desde el panel');
  }

  const { data, error } = await supabase
    .from('articulos')
    .update({ estado: 'anulado' })
    .eq('id', articuloId)
    .in('estado', ['pendiente_revision', 'publicado'])
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

  try {
    await limpiarRecursosNotaDesdeArticulo(createSupabaseAdmin(), articuloId);
  } catch (cleanupError) {
    console.warn(
      `[anularArticulo] No se pudo liberar cuota de Supabase: ${cleanupError.message}`,
    );
  }

  return { ...data, emailBuzon };
}

export async function getArticuloPanelDetalle(articuloId) {
  const supabase = createSupabaseClient();

  const { data: articulo, error } = await supabase
    .from('articulos')
    .select(
      'id, titulo_generado, contenido_generado, estado, medio_id, nota_prensa_id, imagen_destacada_url, imagenes_publicar_urls, email_notificacion, fecha_creacion, wp_post_id, wp_post_url, wp_post_status',
    )
    .eq('id', articuloId)
    .single();

  if (error) {
    throw new Error(`No se pudo leer el artículo: ${error.message}`);
  }

  return articulo;
}
