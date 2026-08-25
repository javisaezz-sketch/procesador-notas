import {
  actualizarPostWordPress,
  etiquetaMedioWordPress,
  leerPostWordPress,
  normalizarMedio,
  crearAuthHeader,
  parsearRespuestaWordPress,
} from './wordpressClient.js';

function featuredMediaCoincide(post, mediaId) {
  return Number(post?.featured_media ?? 0) === Number(mediaId);
}

/**
 * Asigna imagen destacada en cualquier WordPress del panel (GlamCloset, Travelicius, etc.).
 * Intenta featured_media y, si hace falta, meta _thumbnail_id vía REST.
 */
export async function asignarFeaturedMediaPostWordPress(medioRaw, postId, mediaId) {
  const medio = normalizarMedio(medioRaw);
  const mediaIdNum = Number(mediaId);
  const postIdNum = Number(postId);

  if (!mediaIdNum || !postIdNum) {
    throw new Error('Post o media inválidos para imagen destacada');
  }

  let post = await actualizarPostWordPress(medio, postIdNum, {
    featured_media: mediaIdNum,
  });

  if (featuredMediaCoincide(post, mediaIdNum)) {
    return post;
  }

  try {
    post = await actualizarPostWordPress(medio, postIdNum, {
      meta: { _thumbnail_id: mediaIdNum },
    });
  } catch {
    // Algunos WP no exponen _thumbnail_id en REST; seguimos con reintento directo.
  }

  if (featuredMediaCoincide(post, mediaIdNum)) {
    return post;
  }

  post = await actualizarPostWordPress(medio, postIdNum, {
    featured_media: mediaIdNum,
  });

  if (!featuredMediaCoincide(post, mediaIdNum)) {
    throw new Error(
      `${etiquetaMedioWordPress(medio)} no aplicó la imagen destacada ` +
        `(post ${postIdNum}, media ${mediaIdNum}). ` +
        'Comprueba que el snippet wordpress-imagen-destacada-rest.php está en functions.php.',
    );
  }

  return post;
}

export async function verificarFeaturedMediaPostWordPress(medioRaw, postId, mediaIdEsperado) {
  const post = await leerPostWordPress(medioRaw, postId);
  const mediaId = Number(mediaIdEsperado);

  return {
    postId: Number(postId),
    featuredMedia: Number(post?.featured_media ?? 0),
    ok: !mediaId || featuredMediaCoincide(post, mediaId),
  };
}

export async function diagnosticarFeaturedMediaWordPress(medioRaw) {
  const medio = normalizarMedio(medioRaw);
  const endpoint = `${medio.url_wordpress}/wp-json/wp/v2/posts?per_page=1&context=edit`;

  const response = await fetch(endpoint, {
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
      `${etiquetaMedioWordPress(medio)} no permite leer posts vía REST: ${wpMessage}`,
    );
  }

  const ejemplo = Array.isArray(body) ? body[0] : null;

  return {
    slug: medio.slug ?? null,
    soportaFeaturedMedia: Boolean(ejemplo && 'featured_media' in ejemplo),
    ejemploPostId: ejemplo?.id ?? null,
    ejemploFeaturedMedia: ejemplo?.featured_media ?? null,
  };
}
