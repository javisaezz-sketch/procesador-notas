import { createSupabaseClient } from './supabase';
import { getMetaNotificacionWordPress, getNotifyCommentPrefix } from './medios';
import { resolverEmailNotificacionArticulo } from './emailNotificacion';
import { eliminarEmailNotaDesdeArticulo } from './eliminarEmailNota.js';
import { createSupabaseAdmin } from './ingestNota.js';
import { limpiarRecursosNotaDesdeArticulo } from './limpiarAlmacenNota.js';
import { descargarImagenStorage, esUrlStorageProyecto } from './urlsImagenStorage.js';
import { rutaDesdeUrlPublica, resolverUrlDestacada, resolverUrlsSeleccionadas, mismaImagenStorage, urlEnListaImagenes } from './limpiarAlmacenNota.js';
import {
  obtenerExtensionDesdeUrl,
  resolverImagenesParaArticulo,
  aplicarImagenesAlArticulo,
  listarImagenesDeNota,
} from './imagenes';
import {
  quitarImagenesGaleria,
  extraerUrlsImagenesContenido,
  inyectarEmailNotificacionEnContenido,
  prepararContenidoConImagenesSeleccionadas,
} from './contenidoHtml';
import {
  normalizarMedio,
  crearAuthHeader,
  parsearRespuestaWordPress,
  etiquetaMedioWordPress,
  normalizarUrlWordPress,
} from './wordpressClient.js';
import {
  asignarFeaturedMediaPostWordPress,
  diagnosticarFeaturedMediaWordPress,
  verificarFeaturedMediaPostWordPress,
} from './wordpressFeaturedMedia.js';

const ROLES_CON_PERMISO = new Set([
  'administrator',
  'editor',
  'author',
  'contributor',
]);

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

async function asegurarImagenDestacadaEnArticulo(supabase, articulo) {
  const imagenesNota = await listarImagenesDeNota(supabase, articulo.nota_prensa_id);
  const urlsDisponibles = imagenesNota.map((imagen) => imagen.url).filter(Boolean);

  if (Array.isArray(articulo.imagenes_publicar_urls)) {
    const seleccionadas = resolverUrlsSeleccionadas(
      articulo.imagenes_publicar_urls,
      urlsDisponibles,
    );

    if (!seleccionadas.length) {
      return articulo;
    }

    const destacada = resolverUrlDestacada(
      articulo.imagen_destacada_url,
      seleccionadas,
      urlsDisponibles,
    );

    if (
      !destacada ||
      (articulo.imagen_destacada_url &&
        mismaImagenStorage(articulo.imagen_destacada_url, destacada))
    ) {
      return articulo;
    }

    const { error } = await supabase
      .from('articulos')
      .update({ imagen_destacada_url: destacada })
      .eq('id', articulo.id);

    if (error) {
      throw new Error(`No se pudo guardar la imagen destacada: ${error.message}`);
    }

    return { ...articulo, imagen_destacada_url: destacada };
  }

  if (!articulo.imagen_destacada_url) {
    return articulo;
  }

  const { canonicalizarUrlImagen } = await import('./limpiarAlmacenNota.js');
  const destacada =
    canonicalizarUrlImagen(articulo.imagen_destacada_url, urlsDisponibles) ??
    articulo.imagen_destacada_url;

  if (mismaImagenStorage(articulo.imagen_destacada_url, destacada)) {
    return articulo;
  }

  const { error } = await supabase
    .from('articulos')
    .update({ imagen_destacada_url: destacada })
    .eq('id', articulo.id);

  if (error) {
    throw new Error(`No se pudo guardar la imagen destacada: ${error.message}`);
  }

  return { ...articulo, imagen_destacada_url: destacada };
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

  const articuloConDestacada = await asegurarImagenDestacadaEnArticulo(
    supabase,
    articulo,
  );

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
    await aplicarImagenesAlArticulo(supabase, articuloConDestacada, nota);

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
  const slugMedio = medio.slug ? `${medio.slug}-` : '';
  const filename = `${prefijoArchivo}-${slugMedio}${Date.now()}.${extension}`;
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
    throw new Error(`WordPress rechazó la subida de imagen (${etiquetaMedioWordPress(medio)}): ${wpMessage}`);
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
  {
    medio,
    titulo,
    supabaseAdmin,
    imagenDestacadaOrigen = null,
    imagenDestacadaWp = null,
    urlsPermitidas = [],
  },
) {
  if (!contenido?.trim()) {
    return contenido;
  }

  const permitidas = Array.isArray(urlsPermitidas) ? urlsPermitidas : [];
  const urlsEnHtml = extraerUrlsImagenesContenido(contenido).filter((url) =>
    urlEnListaImagenes(url, permitidas),
  );
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

  for (const url of extraerUrlsImagenesContenido(contenido)) {
    if (!esUrlStorageProyecto(url)) {
      continue;
    }

    if (!urlEnListaImagenes(url, permitidas)) {
      resultado = resultado.split(url).join('');
      continue;
    }

    const ruta = rutaDesdeUrlPublica(url);
    const wpUrl = ruta ? wpPorRuta.get(ruta) : null;

    if (wpUrl && wpUrl !== url) {
      resultado = resultado.split(url).join(wpUrl);
    }
  }

  return quitarImagenesGaleria(resultado);
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
  let contenido = articulo.contenido_generado;

  const { data: nota } = await supabase
    .from('notas_prensa')
    .select('contenido_html')
    .eq('id', articulo.nota_prensa_id)
    .maybeSingle();

  const imagenesNota = await listarImagenesDeNota(supabase, articulo.nota_prensa_id, {
    contenidoHtml: nota?.contenido_html,
  });

  const imagenes = await resolverImagenesParaArticulo(supabase, {
    notaPrensaId: articulo.nota_prensa_id,
    medioId: articulo.medio_id,
    imagenDestacadaUrl: articulo.imagen_destacada_url,
    contenidoHtml: nota?.contenido_html,
    imagenesPublicarUrls: articulo.imagenes_publicar_urls,
  });

  const urlsDisponibles = imagenesNota.map((imagen) => imagen.url).filter(Boolean);
  const seleccionManual = Array.isArray(articulo.imagenes_publicar_urls);
  const seleccionadas = seleccionManual
    ? resolverUrlsSeleccionadas(articulo.imagenes_publicar_urls, urlsDisponibles)
    : [];

  if (seleccionManual && imagenesNota.length && seleccionadas.length === 0) {
    throw new Error(
      `Selecciona qué imágenes publicar en el dashboard antes de enviar a ${etiquetaMedioWordPress(medio)}.`,
    );
  }

  if (
    seleccionManual &&
    articulo.imagenes_publicar_urls.length &&
    !imagenes.destacadaUrl
  ) {
    throw new Error(
      'No se pudo determinar la imagen destacada. Abre el artículo, marca la estrella y guarda antes de publicar.',
    );
  }

  const urlsCuerpo = imagenes.adicionalesUrls;
  const urlsPermitidasEnContenido = [
    ...urlsCuerpo,
    ...(imagenes.destacadaUrl ? [imagenes.destacadaUrl] : []),
  ];

  contenido = prepararContenidoConImagenesSeleccionadas(
    contenido,
    urlsCuerpo,
    articulo.titulo_generado,
  );

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
    urlsPermitidas: urlsPermitidasEnContenido,
  });

  contenido = quitarImagenesGaleria(contenido);

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

  contenido = quitarImagenesGaleria(contenido);
  postBody.content = contenido;

  const featuredMediaId = featuredMedia?.id ? Number(featuredMedia.id) : null;

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

  let parsedBody = await parsearRespuestaWordPress(response);

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

  const postId = parsedBody?.id ?? postExistenteId;

  if (featuredMediaId && postId) {
    parsedBody = await asignarFeaturedMediaPostWordPress(
      medio,
      postId,
      featuredMediaId,
    );
  }

  return {
    ...parsedBody,
    categoria,
    featuredMediaId: featuredMedia?.id ?? null,
    contenidoPublicado: contenido,
  };
}

export async function marcarArticuloComoPublicado(
  articuloId,
  wordpressPost,
  { contenidoGenerado = null } = {},
) {
  const supabase = createSupabaseClient();

  const payload = {
    estado: 'publicado',
    wp_post_id: wordpressPost?.id ?? null,
    wp_post_url: wordpressPost?.link ?? null,
    wp_post_status: wordpressPost?.status ?? 'draft',
  };

  if (typeof contenidoGenerado === 'string' && contenidoGenerado.trim()) {
    payload.contenido_generado = contenidoGenerado;
  }

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

  let featuredAntesPublicar = null;

  try {
    featuredAntesPublicar = await verificarFeaturedMediaPostWordPress(
      medioNorm,
      articulo.wp_post_id,
    );
  } catch (errorFeatured) {
    console.warn(
      `[publicarPostEnWordPress] ${etiquetaMedioWordPress(medioNorm)}: ` +
        `no se pudo leer featured_media del borrador ${articulo.wp_post_id}: ${errorFeatured.message}`,
    );
  }

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

    throw new Error(
      `${etiquetaMedioWordPress(medioNorm)} no pudo publicar el artículo: ${wpMessage}`,
    );
  }

  if (featuredAntesPublicar && !featuredAntesPublicar.featuredMedia) {
    console.warn(
      `[publicarPostEnWordPress] ${etiquetaMedioWordPress(medioNorm)}: ` +
        `el borrador ${articulo.wp_post_id} se publicó sin imagen destacada. ` +
        'Reenvía el artículo desde Pendientes tras guardar la estrella.',
    );
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
      featuredMediaId: featuredAntesPublicar?.featuredMedia ?? null,
    };
  }

  return {
    articulo: actualizado,
    wordpressPostUrl: parsedBody?.link ?? actualizado?.wp_post_url ?? null,
    medio: medio.nombre,
    featuredMediaId: featuredAntesPublicar?.featuredMedia ?? null,
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
    { contenidoGenerado: wordpressPost.contenidoPublicado },
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
    medioSlug: medio.slug ?? null,
    emailBuzon,
  };
}

export async function diagnosticarMedio(medioId) {
  const supabase = createSupabaseClient();

  const { data: medio, error } = await supabase
    .from('medios')
    .select('id, nombre, slug, url_wordpress, api_user, api_password')
    .eq('id', medioId)
    .single();

  if (error || !medio) {
    throw new Error('Medio no encontrado');
  }

  const usuario = await verificarUsuarioWordPress(medio);
  const featured = await diagnosticarFeaturedMediaWordPress(medio);

  return {
    medio: medio.nombre,
    slug: medio.slug ?? null,
    url: normalizarUrlWordPress(medio.url_wordpress),
    api_user: medio.api_user.trim(),
    wordpressUser: usuario,
    imagenDestacadaRest: featured,
  };
}
