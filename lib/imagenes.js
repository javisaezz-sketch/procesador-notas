export async function listarImagenesDeNota(
  supabase,
  notaPrensaId,
  { contenidoHtml } = {},
) {
  const { data: deNota, error: errorNota } = await supabase
    .from('notas_prensa_imagenes')
    .select('id, url, nombre_archivo')
    .eq('nota_prensa_id', notaPrensaId)
    .order('id', { ascending: true });

  if (errorNota) {
    throw new Error(`Error al leer imágenes de la nota: ${errorNota.message}`);
  }

  if (deNota?.length) {
    return deNota;
  }

  if (contenidoHtml) {
    const { guardarImagenesDesdeHtml } = await import('./extraerImagenesEmail.js');
    await guardarImagenesDesdeHtml(supabase, notaPrensaId, contenidoHtml);

    const { data: recienGuardadas, error: errorRecientes } = await supabase
      .from('notas_prensa_imagenes')
      .select('id, url, nombre_archivo')
      .eq('nota_prensa_id', notaPrensaId)
      .order('id', { ascending: true });

    if (errorRecientes) {
      throw new Error(`Error al leer imágenes recién guardadas: ${errorRecientes.message}`);
    }

    return recienGuardadas ?? [];
  }

  return [];
}

export async function seleccionarImagenAleatoria(supabase, medioId) {
  const { data: delMedio, error: errorMedio } = await supabase
    .from('imagenes')
    .select('id, url, titulo')
    .eq('medio_id', medioId)
    .eq('activa', true);

  if (errorMedio) {
    throw new Error(`Error al leer imágenes del medio: ${errorMedio.message}`);
  }

  let pool = delMedio ?? [];

  if (pool.length === 0) {
    const { data: globales, error: errorGlobal } = await supabase
      .from('imagenes')
      .select('id, url, titulo')
      .is('medio_id', null)
      .eq('activa', true);

    if (errorGlobal) {
      throw new Error(`Error al leer imágenes globales: ${errorGlobal.message}`);
    }

    pool = globales ?? [];
  }

  if (pool.length === 0) {
    return null;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

export function obtenerExtensionDesdeUrl(url, contentType) {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';

  const match = url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
  if (match) return match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();

  return 'jpg';
}

export async function descargarImagen(url) {
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());

  return { buffer, contentType };
}

export async function resolverImagenesParaArticulo(
  supabase,
  {
    notaPrensaId,
    medioId,
    imagenDestacadaUrl,
    contenidoHtml,
    imagenesPublicarUrls,
  },
) {
  const imagenes = await listarImagenesDeNota(supabase, notaPrensaId, {
    contenidoHtml,
  });
  const urlsDisponibles = imagenes.map((imagen) => imagen.url).filter(Boolean);

  if (Array.isArray(imagenesPublicarUrls)) {
    const seleccionadas = imagenesPublicarUrls.filter((url) =>
      urlsDisponibles.includes(url),
    );

    if (seleccionadas.length === 0) {
      return { destacadaUrl: null, adicionalesUrls: [] };
    }

    const destacadaUrl =
      imagenDestacadaUrl && seleccionadas.includes(imagenDestacadaUrl)
        ? imagenDestacadaUrl
        : seleccionadas[0];
    const adicionalesUrls = seleccionadas.filter((url) => url !== destacadaUrl);

    return { destacadaUrl, adicionalesUrls };
  }

  const urls = urlsDisponibles;

  if (urls.length > 0) {
    const destacadaUrl = imagenDestacadaUrl || urls[0];
    const adicionalesUrls = urls.filter((url) => url !== destacadaUrl);

    return { destacadaUrl, adicionalesUrls };
  }

  if (imagenDestacadaUrl) {
    return { destacadaUrl: imagenDestacadaUrl, adicionalesUrls: [] };
  }

  const fallback = await seleccionarImagenAleatoria(supabase, medioId);

  return {
    destacadaUrl: fallback?.url ?? null,
    adicionalesUrls: [],
  };
}

export async function seleccionarImagenParaArticulo(
  supabase,
  notaPrensaId,
  medioId,
  options = {},
) {
  const { destacadaUrl } = await resolverImagenesParaArticulo(supabase, {
    notaPrensaId,
    medioId,
    contenidoHtml: options.contenidoHtml,
  });

  if (!destacadaUrl) {
    return null;
  }

  return { url: destacadaUrl };
}

export async function resolverImagenArticulo(
  supabase,
  { notaPrensaId, medioId, imagenDestacadaUrl, contenidoHtml },
) {
  const { destacadaUrl } = await resolverImagenesParaArticulo(supabase, {
    notaPrensaId,
    medioId,
    imagenDestacadaUrl,
    contenidoHtml,
  });

  return destacadaUrl ?? null;
}

export async function aplicarImagenesAlArticulo(supabase, articulo, nota) {
  const imagenes = await resolverImagenesParaArticulo(supabase, {
    notaPrensaId: articulo.nota_prensa_id,
    medioId: articulo.medio_id,
    imagenDestacadaUrl: articulo.imagen_destacada_url,
    contenidoHtml: nota?.contenido_html,
    imagenesPublicarUrls: articulo.imagenes_publicar_urls,
  });

  const seleccionManual = Array.isArray(articulo.imagenes_publicar_urls);

  const {
    quitarImagenIncrustada,
    quitarImagenesGaleria,
    inyectarImagenesAlFinal,
  } = await import('./contenidoHtml.js');

  let contenido = quitarImagenesGaleria(
    quitarImagenIncrustada(articulo.contenido_generado),
  );

  if (imagenes.adicionalesUrls.length) {
    contenido = inyectarImagenesAlFinal(
      contenido,
      imagenes.adicionalesUrls,
      articulo.titulo_generado,
    );
  }

  const cambios = {};
  if (contenido !== articulo.contenido_generado) {
    cambios.contenido_generado = contenido;
  }
  if (imagenes.destacadaUrl !== articulo.imagen_destacada_url && !seleccionManual) {
    cambios.imagen_destacada_url = imagenes.destacadaUrl;
  }

  if (Object.keys(cambios).length) {
    const { error } = await supabase
      .from('articulos')
      .update(cambios)
      .eq('id', articulo.id);

    if (error) {
      throw new Error(`No se pudo actualizar imágenes del artículo: ${error.message}`);
    }
  }

  return {
    articulo: {
      ...articulo,
      ...cambios,
    },
    imagenes,
    imagenesAdicionales: imagenes.adicionalesUrls.length,
  };
}

export async function sincronizarImagenesPendientes(supabase) {
  const { data: articulos, error } = await supabase
    .from('articulos')
    .select('id, titulo_generado, contenido_generado, imagen_destacada_url, nota_prensa_id, medio_id, medios(nombre, slug)')
    .eq('estado', 'pendiente_revision')
    .order('id', { ascending: true });

  if (error) {
    throw new Error(`No se pudieron leer artículos pendientes: ${error.message}`);
  }

  const resultados = [];

  for (const articulo of articulos ?? []) {
    const { data: nota } = await supabase
      .from('notas_prensa')
      .select('contenido_html')
      .eq('id', articulo.nota_prensa_id)
      .maybeSingle();

    const { imagenesAdicionales } = await aplicarImagenesAlArticulo(
      supabase,
      articulo,
      nota,
    );

    resultados.push({
      id: articulo.id,
      medio: articulo.medios?.nombre ?? articulo.medio_id,
      titulo: articulo.titulo_generado,
      imagenesAdicionales,
    });
  }

  return resultados;
}
