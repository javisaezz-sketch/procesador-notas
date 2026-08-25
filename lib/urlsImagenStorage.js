import { rutaDesdeUrlPublica } from './limpiarAlmacenNota.js';
import { extraerUrlsImagenesContenido } from './contenidoHtml.js';

export const BUCKET_NOTAS = 'notas-prensa';
const TTL_FIRMA_SEGUNDOS = Number(process.env.IMAGEN_FIRMA_TTL ?? 3600);

export function esUrlStorageProyecto(url) {
  if (!url) return false;
  return (
    url.includes(`/object/public/${BUCKET_NOTAS}/`) ||
    url.includes(`/object/sign/${BUCKET_NOTAS}/`) ||
    url.includes(`/${BUCKET_NOTAS}/`)
  );
}

export async function firmarUrlImagenStorage(supabase, url, expiresIn = TTL_FIRMA_SEGUNDOS) {
  if (!esUrlStorageProyecto(url)) {
    return url;
  }

  const path = rutaDesdeUrlPublica(url);
  if (!path) {
    return url;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NOTAS)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.warn(`[storage] No se pudo firmar URL (${path}): ${error.message}`);
    return url;
  }

  return data.signedUrl;
}

export async function firmarUrlsImagenesStorage(supabase, urls) {
  if (!urls?.length) return [];

  return Promise.all(urls.map((url) => firmarUrlImagenStorage(supabase, url)));
}

export async function firmarImagenesNota(supabase, imagenes) {
  if (!imagenes?.length) return [];

  return Promise.all(
    imagenes.map(async (imagen) => ({
      ...imagen,
      url: await firmarUrlImagenStorage(supabase, imagen.url),
    })),
  );
}

export async function descargarImagenStorage(supabase, url) {
  const path = rutaDesdeUrlPublica(url);

  if (!path) {
    const { descargarImagen } = await import('./imagenes.js');
    return descargarImagen(url);
  }

  const { data, error } = await supabase.storage.from(BUCKET_NOTAS).download(path);

  if (error) {
    throw new Error(`No se pudo descargar imagen de Storage (${path}): ${error.message}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());

  return {
    buffer,
    contentType: data.type || 'image/jpeg',
  };
}

export async function firmarImagenesEnContenidoHtml(supabase, html) {
  if (!html?.trim()) {
    return html;
  }

  const urlsEnHtml = extraerUrlsImagenesContenido(html);
  const firmadasPorRuta = new Map();

  for (const url of urlsEnHtml) {
    if (!esUrlStorageProyecto(url)) {
      continue;
    }

    const ruta = rutaDesdeUrlPublica(url);
    if (!ruta || firmadasPorRuta.has(ruta)) {
      continue;
    }

    firmadasPorRuta.set(ruta, await firmarUrlImagenStorage(supabase, url));
  }

  let resultado = html;

  for (const url of urlsEnHtml) {
    if (!esUrlStorageProyecto(url)) {
      continue;
    }

    const ruta = rutaDesdeUrlPublica(url);
    const firmada = ruta ? firmadasPorRuta.get(ruta) : null;

    if (firmada && firmada !== url) {
      resultado = resultado.split(url).join(firmada);
    }
  }

  return resultado;
}
