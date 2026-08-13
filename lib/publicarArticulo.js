import { createSupabaseClient } from './supabase';
import { getMetaNotificacionWordPress, getNotifyCommentPrefix } from './medios';
import { resolverEmailNotificacionArticulo } from './emailNotificacion';
import { eliminarEmailNotaDesdeArticulo } from './eliminarEmailNota.js';
import {
  descargarImagen,
  obtenerExtensionDesdeUrl,
  resolverImagenesParaArticulo,
  aplicarImagenesAlArticulo,
} from './imagenes';
import {
  quitarImagenIncrustada,
  quitarImagenesGaleria,
  inyectarImagenesAlFinal,
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
    .select('id, titulo_generado, contenido_generado, estado, medio_id, imagen_destacada_url, imagenes_publicar_urls, email_notificacion, nota_prensa_id')
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
  { prefijoArchivo = 'imagen' } = {},
) {
  const medio = normalizarMedio(medioRaw);
  const { buffer, contentType } = await descargarImagen(imageUrl);
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

export async function subirImagenDestacadaWordPress(medioRaw, imageUrl, titulo) {
  return subirImagenWordPress(medioRaw, imageUrl, titulo, {
    prefijoArchivo: 'destacada',
  });
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
    );
  }

  const urlsGaleriaWp = [];
  for (const url of imagenes.adicionalesUrls) {
    const subida = await subirImagenWordPress(medio, url, articulo.titulo_generado, {
      prefijoArchivo: 'galeria',
    });
    urlsGaleriaWp.push(subida.source_url);
  }

  if (urlsGaleriaWp.length) {
    contenido = inyectarImagenesAlFinal(
      contenido,
      urlsGaleriaWp,
      articulo.titulo_generado,
    );
  }

  const endpoint = `${medio.url_wordpress}/wp-json/wp/v2/posts`;
  const categoria = await obtenerCategoriaWordPress(medio, categoriaSlug);

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

  const response = await fetch(endpoint, {
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
  };

  const { data, error } = await supabase
    .from('articulos')
    .update(payload)
    .eq('id', articuloId)
    .eq('estado', 'pendiente_revision')
    .select('id, estado, wp_post_id, wp_post_url')
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
