import { createSupabaseClient } from './supabase';
import { getMetaNotificacionWordPress, getNotifyCommentPrefix } from './medios';
import { resolverEmailNotificacionArticulo } from './emailNotificacion';
import { eliminarEmailNotaDesdeArticulo } from './eliminarEmailNota.js';
import { createSupabaseAdmin } from './ingestNota.js';
import { limpiarRecursosNotaDesdeArticulo } from './limpiarAlmacenNota.js';
import { descargarImagenStorage, esUrlStorageProyecto } from './urlsImagenStorage.js';
import { rutaDesdeUrlPublica } from './limpiarAlmacenNota.js';
import {
  obtenerExtensionDesdeUrl,
  resolverImagenesParaArticulo,
  aplicarImagenesAlArticulo,
} from './imagenes';
import {
  quitarImagenIncrustada,
  quitarImagenesGaleria,
  extraerUrlsImagenesContenido,
  inyectarEmailNotificacionEnContenido,
} from './contenidoHtml';

const ROLES_CON_PERMISO = new Set([
  'administrator',
  'editor',
  'author',
  'contributor',
]);

function normalizarUrlWordPress(url) {
  return url.trim().replace(/\/+$/, '');
}

function normalizarMedio(medio) {
  return {
    ...medio,
    url_wordpress: normalizarUrlWordPress(medio.url_wordpress),
    api_user: medio.api_user.trim(),
    api_password: medio.api_password.replace(/\s+/g, ''),
  };
}

function crearAuthHeader(medio) {
  const credentials = Buffer.from(
    `${medio.api_user}:${medio.api_password}`,
  ).toString('base64');

  return `Basic ${credentials}`;
}

async function parsearRespuestaWordPress(response) {
  const responseBody = await response.text();
  let parsedBody = null;

  if (responseBody) {
    try {
      parsedBody = JSON.parse(responseBody);
    } catch {
      parsedBody = { message: responseBody };
    }
  }

  return parsedBody;
}

export async function verificarUsuarioWordPress(medioRaw) {
  const medio = normalizarMedio(medioRaw);
  const endpoint = `${medio.url_wordpress}/wp-json/wp/v2/users/me?context=edit`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: crearAuthHeader(medio),
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const body = await parsearRespuestaWordPress(response);

  if (!response.ok) {
    const wpMessage = body?.message || `Error HTTP ${response.status}`;
    throw new Error(
      `Autenticación WordPress fallida para "${medio.api_user}": ${wpMessage}. ` +
        'Comprueba api_user (nombre de login, no email) y la contraseña de aplicación.',
    );
  }

  const roles = body?.roles ?? [];
  const puedeCrear = roles.some((rol) => ROLES_CON_PERMISO.has(rol));

  if (!puedeCrear) {
    throw new Error(
      `El usuario WordPress "${body?.slug || medio.api_user}" tiene roles [${roles.join(', ') || 'sin rol'}] ` +
        'y no puede crear entradas. Usa un usuario Administrador o Editor.',
    );
  }

  return {
    id: body.id,
    slug: body.slug,
    name: body.name,
    roles,
  };
}

export async function getArticuloParaPublicar(articuloId) {
  const supabase = createSupabaseClient();

  const { data: articulo, error } = await supabase
    .from('articulos')
    .select('id, titulo_generado, contenido_generado, estado, medio_id, imagen_destacada_url, imagenes_publicar_urls, email_notificacion, nota_prensa_id, wp_post_id, wp_post_url, wp_post_status')
    .eq('id', articuloId)
    .single();

  if (error) {
    throw new Error(`No se pudo leer el artículo: ${error.message}`);
  }

  if (!articulo) {
    throw new Error('Artículo no encontrado');
  }

  if (articulo.estado !== 'pendiente_revision') {
    throw new Error('Este artículo ya no está pendiente de revisión');
  }

  const { data: medio, error: medioError } = await supabase
    .from('medios')
    .select('id, nombre, slug, url_wordpress, api_user, api_password')
    .eq('id', articulo.medio_id)
    .single();

  if (medioError) {
    throw new Error(`No se pudo leer el medio: ${medioError.message}`);
  }

  if (!medio?.url_wordpress || !medio?.api_user || !medio?.api_password) {
    throw new Error(
      'El medio no tiene configurados url_wordpress, api_user o api_password',
    );
  }

  const { data: nota } = await supabase
    .from('notas_prensa')
    .select('contenido_html, contenido_original, remitente')
    .eq('id', articulo.nota_prensa_id)
    .maybeSingle();

  const { articulo: articuloSync, imagenesAdicionales } =
    await aplicarImagenesAlArticulo(supabase, articulo, nota);

  return {
    articulo: {
      ...articuloSync,
      email_notificacion: resolverEmailNotificacionArticulo(articuloSync, nota),
      imagenes_adicionales: imagenesAdicionales,
    },
    medio: normalizarMedio(medio),
  };
}

export async function subirImagenWordPress(
  medioRaw,
  imageUrl,
  titulo,
  { prefijoArchivo = 'imagen', supabaseAdmin = null } = {},
) {
  const medio = normalizarMedio(medioRaw);
  const storageClient = supabaseAdmin ?? createSupabaseAdmin();
  const { buffer, contentType } = await descargarImagenStorage(storageClient, imageUrl);
  const extension = obtenerExtensionDesdeUrl(imageUrl, contentType);
  const filename = `${prefijoArchivo}-${Date.now()}.${extension}`;
  const endpoint = `${medio.url_wordpress}/wp-json/wp/v2/media`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: crearAuthHeader(medio),
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      Accept: 'application/json',
    },
    body: buffer,
    cache: 'no-store',
  });

  const parsedBody = await parsearRespuestaWordPress(response);

  if (!response.ok) {
    const wpMessage =
      parsedBody?.message ||
      parsedBody?.code ||
      `Error HTTP ${response.status}`;
    throw new Error(`WordPress rechazó la subida de imagen: ${wpMessage}`);
  }

  if (titulo) {
    await fetch(`${endpoint}/${parsedBody.id}`, {
      method: 'POST',
      headers: {
        Authorization: crearAuthHeader(medio),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        title: titulo,
        alt_text: titulo,
      }),
      cache: 'no-store',
    });
  }

  return {
    id: parsedBody.id,
    source_url: parsedBody.source_url,
  };
}

export async function subirImagenDestacadaWordPress(
  medioRaw,
  imageUrl,
  titulo,
  supabaseAdmin = null,
) {
  return subirImagenWordPress(medioRaw, imageUrl, titulo, {
    prefijoArchivo: 'destacada',
    supabaseAdmin,
  });
}

async function migrarImagenesSupabaseEnContenido(
  contenido,
  { medio, titulo, supabaseAdmin, imagenDestacadaOrigen = null, imagenDestacadaWp = null },
) {
  if (!contenido?.trim()) {
    return contenido;
  }

  const urlsEnHtml = extraerUrlsImagenesContenido(contenido);
  const wpPorRuta = new Map();

  if (
    imagenDestacadaOrigen &&
    imagenDestacadaWp &&
    esUrlStorageProyecto(imagenDestacadaOrigen)
  ) {
    const rutaDestacada = rutaDesdeUrlPublica(imagenDestacadaOrigen);
    if (rutaDestacada) {
      wpPorRuta.set(rutaDestacada, imagenDestacadaWp);
    }
  }

  for (const url of urlsEnHtml) {
    if (!esUrlStorageProyecto(url)) {
      continue;
    }

    const ruta = rutaDesdeUrlPublica(url);
    if (!ruta || wpPorRuta.has(ruta)) {
      continue;
    }

    const subida = await subirImagenWordPress(medio, url, titulo, {
      prefijoArchivo: 'cuerpo',
      supabaseAdmin,
    });
    wpPorRuta.set(ruta, subida.source_url);
  }

  let resultado = contenido;

  for (const url of urlsEnHtml) {
    if (!esUrlStorageProyecto(url)) {
      continue;
    }

    const ruta = rutaDesdeUrlPublica(url);
    const wpUrl = ruta ? wpPorRuta.get(ruta) : null;

    if (wpUrl && wpUrl !== url) {
      resultado = resultado.split(url).join(wpUrl);
    }
  }

  return resultado;
}

export async function obtenerCategoriaWordPress(medioRaw, slug) {
  const medio = normalizarMedio(medioRaw);
  const endpoint = `${medio.url_wordpress}/wp-json/wp/v2/categories?slug=${encodeURIComponent(slug)}`;

  const response = await fetch(endpoint, {
    headers: {
      Authorization: crearAuthHeader(medio),
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const body = await parsearRespuestaWordPress(response);

  if (!response.ok || !body?.length) {
    throw new Error(
      `Categoría "${slug}" no encontrada en WordPress. Comprueba el slug en el panel.`,
    );
  }

  return { id: body[0].id, nombre: body[0].name, slug: body[0].slug };
}

export async function publicarEnWordPress(articulo, medioRaw, categoriaSlug, options = {}) {
  const medio = normalizarMedio(medioRaw);
  const usuario = await verificarUsuarioWordPress(medio);
  const supabase = options.supabase ?? createSupabaseClient();
  const supabaseAdmin = createSupabaseAdmin();

  let featuredMedia = null;
  let contenido = quitarImagenesGaleria(
    quitarImagenIncrustada(articulo.contenido_generado),
  );

  const { data: nota } = await supabase
    .from('notas_prensa')
    .select('contenido_html')
    .eq('id', articulo.nota_prensa_id)
    .maybeSingle();

  const imagenes = await resolverImagenesParaArticulo(supabase, {
    notaPrensaId: articulo.nota_prensa_id,
    medioId: articulo.medio_id,
    imagenDestacadaUrl: articulo.imagen_destacada_url,
    contenidoHtml: nota?.contenido_html,
    imagenesPublicarUrls: articulo.imagenes_publicar_urls,
  });

  if (imagenes.destacadaUrl) {
    featuredMedia = await subirImagenDestacadaWordPress(
      medio,
      imagenes.destacadaUrl,
      articulo.titulo_generado,
      supabaseAdmin,
    );
  }

  contenido = await migrarImagenesSupabaseEnContenido(contenido, {
    medio,
    titulo: articulo.titulo_generado,
    supabaseAdmin,
    imagenDestacadaOrigen: imagenes.destacadaUrl,
    imagenDestacadaWp: featuredMedia?.source_url ?? null,
  });

  const endpoint = `${medio.url_wordpress}/wp-json/wp/v2/posts`;
  const categoria = await obtenerCategoriaWordPress(medio, categoriaSlug);
  const postExistenteId = articulo.wp_post_id ? Number(articulo.wp_post_id) : null;

  const postBody = {
    title: articulo.titulo_generado,
    content: contenido,
    status: 'draft',
    author: usuario.id,
    categories: [categoria.id],
  };

  const metaKey = getMetaNotificacionWordPress(medio);
  const notifyPrefix = getNotifyCommentPrefix(medio);
  const emailNotificacion = articulo.email_notificacion?.trim();

  if (emailNotificacion && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNotificacion)) {
    if (notifyPrefix) {
      contenido = inyectarEmailNotificacionEnContenido(
        contenido,
        emailNotificacion,
        notifyPrefix,
      );
    }

    if (metaKey) {
      postBody.meta = {
        [metaKey]: emailNotificacion,
      };
    }
  }

  postBody.content = contenido;

  if (featuredMedia?.id) {
    postBody.featured_media = featuredMedia.id;
  }

  const targetUrl = postExistenteId
    ? `${endpoint}/${postExistenteId}`
    : endpoint;

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      Authorization: crearAuthHeader(medio),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(postBody),
    cache: 'no-store',
  });

  const parsedBody = await parsearRespuestaWordPress(response);

  if (!response.ok) {
    const wpMessage =
      parsedBody?.message ||
      parsedBody?.code ||
      `Error HTTP ${response.status}`;

    throw new Error(
      `WordPress rechazó la publicación con el usuario "${usuario.slug}" ` +
        `(roles: ${usuario.roles.join(', ')}): ${wpMessage}`,
    );
  }

  return { ...parsedBody, categoria, featuredMediaId: featuredMedia?.id ?? null };
}

export async function marcarArticuloComoPublicado(articuloId, wordpressPost) {
  const supabase = createSupabaseClient();

  const payload = {
    estado: 'publicado',
    wp_post_id: wordpressPost?.id ?? null,
    wp_post_url: wordpressPost?.link ?? null,
    wp_post_status: wordpressPost?.status ?? 'draft',
  };

  const { data, error } = await supabase
    .from('articulos')
    .update(payload)
    .eq('id', articuloId)
    .eq('estado', 'pendiente_revision')
    .select('id, estado, wp_post_id, wp_post_url, wp_post_status')
    .single();

  if (error) {
    const soloEstado = await supabase
      .from('articulos')
      .update({ estado: 'publicado' })
      .eq('id', articuloId)
      .eq('estado', 'pendiente_revision')
      .select('id, estado')
      .single();

    if (soloEstado.error) {
      throw new Error(`No se pudo actualizar el artículo: ${error.message}`);
    }

    return soloEstado.data;
  }

  return data;
}

export async function publicarPostEnWordPress(articuloId) {
  const supabase = createSupabaseClient();

  const { data: articulo, error } = await supabase
    .from('articulos')
    .select('id, titulo_generado, estado, medio_id, wp_post_id, wp_post_status, wp_post_url')
    .eq('id', articuloId)
    .single();

  if (error || !articulo) {
    throw new Error('Artículo no encontrado');
  }

  if (articulo.estado !== 'publicado') {
    throw new Error('Este artículo aún no está aprobado');
  }

  if (!articulo.wp_post_id) {
    throw new Error('No hay borrador de WordPress vinculado a este artículo');
  }

  if (articulo.wp_post_status === 'publish') {
    throw new Error('Este artículo ya está publicado en la web');
  }

  const { data: medio, error: medioError } = await supabase
    .from('medios')
    .select('id, nombre, slug, url_wordpress, api_user, api_password')
    .eq('id', articulo.medio_id)
    .single();

  if (medioError || !medio) {
    throw new Error('No se pudo leer el medio del artículo');
  }

  const medioNorm = normalizarMedio(medio);
  await verificarUsuarioWordPress(medioNorm);

  const endpoint = `${medioNorm.url_wordpress}/wp-json/wp/v2/posts/${articulo.wp_post_id}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: crearAuthHeader(medioNorm),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ status: 'publish' }),
    cache: 'no-store',
  });

  const parsedBody = await parsearRespuestaWordPress(response);

  if (!response.ok) {
    const wpMessage =
      parsedBody?.message ||
      parsedBody?.code ||
      `Error HTTP ${response.status}`;

    throw new Error(`WordPress no pudo publicar el artículo: ${wpMessage}`);
  }

  const updatePayload = {
    wp_post_status: parsedBody?.status ?? 'publish',
    wp_post_url: parsedBody?.link ?? articulo.wp_post_url,
  };

  const { data: actualizado, error: updateError } = await supabase
    .from('articulos')
    .update(updatePayload)
    .eq('id', articuloId)
    .select('id, titulo_generado, wp_post_id, wp_post_url, wp_post_status')
    .single();

  if (updateError) {
    const sinEstado = await supabase
      .from('articulos')
      .update({ wp_post_url: parsedBody?.link ?? articulo.wp_post_url })
      .eq('id', articuloId)
      .select('id, titulo_generado, wp_post_id, wp_post_url')
      .single();

    if (sinEstado.error) {
      throw new Error(`Publicado en WP pero no se pudo guardar el estado: ${updateError.message}`);
    }

    return {
      articulo: {
        ...sinEstado.data,
        wp_post_status: 'publish',
      },
      wordpressPostUrl: parsedBody?.link ?? articulo.wp_post_url,
      medio: medio.nombre,
    };
  }

  return {
    articulo: actualizado,
    wordpressPostUrl: parsedBody?.link ?? actualizado?.wp_post_url ?? null,
    medio: medio.nombre,
  };
}

export async function publicarArticulo(articuloId, categoriaSlug) {
  if (!categoriaSlug) {
    throw new Error('Debes seleccionar una categoría de WordPress');
  }

  const { articulo, medio } = await getArticuloParaPublicar(articuloId);
  const wordpressPost = await publicarEnWordPress(articulo, medio, categoriaSlug);
  const articuloActualizado = await marcarArticuloComoPublicado(
    articuloId,
    wordpressPost,
  );

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
      `[publicarArticulo] No se pudo liberar cuota de Supabase: ${cleanupError.message}`,
    );
  }

  return {
    articulo: articuloActualizado,
    wordpressPostId: wordpressPost?.id ?? null,
    wordpressPostUrl: wordpressPost?.link ?? articuloActualizado?.wp_post_url ?? null,
    featuredMediaId: wordpressPost?.featured_media ?? wordpressPost?.featuredMediaId ?? null,
    imagenDestacada: articulo.imagen_destacada_url ?? null,
    emailNotificacion: articulo.email_notificacion ?? null,
    categoria: wordpressPost.categoria?.nombre ?? categoriaSlug,
    medio: medio.nombre,
    emailBuzon,
  };
}

export async function diagnosticarMedio(medioId) {
  const supabase = createSupabaseClient();

  const { data: medio, error } = await supabase
    .from('medios')
    .select('id, nombre, url_wordpress, api_user, api_password')
    .eq('id', medioId)
    .single();

  if (error || !medio) {
    throw new Error('Medio no encontrado');
  }

  const usuario = await verificarUsuarioWordPress(medio);

  return {
    medio: medio.nombre,
    url: normalizarUrlWordPress(medio.url_wordpress),
    api_user: medio.api_user.trim(),
    wordpressUser: usuario,
  };
}
