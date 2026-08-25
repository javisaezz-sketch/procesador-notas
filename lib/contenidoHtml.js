import { urlEnListaImagenes } from './limpiarAlmacenNota.js';

function escaparHtml(texto = '') {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escaparAttrHtml(texto = '') {
  return escaparHtml(texto);
}

export function inyectarImagenEnContenido(html, imagenUrl, titulo = '') {
  if (!html?.trim() || !imagenUrl?.trim()) {
    return html;
  }

  if (html.includes(imagenUrl)) {
    return html;
  }

  const alt = escaparHtml(titulo);
  const figure =
    `<figure class="imagen-destacada">` +
    `<img src="${imagenUrl}" alt="${alt}" loading="lazy" />` +
    `</figure>`;

  if (/<article[^>]*>/i.test(html)) {
    return html.replace(/(<article[^>]*>)/i, `$1${figure}`);
  }

  return `${figure}${html}`;
}

export function contenidoTieneImagen(html) {
  return /<img[\s>]/i.test(html || '');
}

export function quitarImagenIncrustada(html) {
  if (!html) return html;

  return html
    .replace(/<figure[^>]*class=["'][^"']*imagen-destacada[^"']*["'][^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<figure class="imagen-destacada">[\s\S]*?<\/figure>/gi, '')
    .trim();
}

/** Quita figuras/img que quedaron después de </article> (galería fantasma). */
export function quitarImagenesFueraDeArticle(html) {
  if (!html || !/<\/article>/i.test(html)) {
    return html;
  }

  const cierre = html.search(/<\/article>/i);
  if (cierre === -1) return html;

  const antes = html.slice(0, cierre);
  let despues = html.slice(cierre);

  despues = despues
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<img\b[^>]*>/gi, '');

  return `${antes}${despues}`;
}

export function quitarImagenesGaleria(html) {
  if (!html) return html;

  return quitarImagenesFueraDeArticle(
    html
      .replace(/<section[^>]*class=["'][^"']*galeria-nota[^"']*["'][^>]*>[\s\S]*?<\/section>/gi, '')
      .replace(/<div[^>]*class=["'][^"']*galeria-adjunta[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<section[^>]*class=["'][^"']*imagenes-adicionales[^"']*["'][^>]*>[\s\S]*?<\/section>/gi, '')
      .replace(/<figure[^>]*class=["'][^"']*imagen-galeria[^"']*["'][^>]*>[\s\S]*?<\/figure>/gi, '')
      .replace(/<figure[^>]*class=["'][^"']*wp-block-gallery[^"']*["'][^>]*>[\s\S]*?<\/figure>/gi, '')
      .replace(/<ul[^>]*class=["'][^"']*blocks-gallery-grid[^"']*["'][^>]*>[\s\S]*?<\/ul>/gi, '')
      .replace(/\[gallery[^\]]*\]/gi, ''),
  ).trim();
}

export function inyectarImagenesAlFinal(html, urls, titulo = '') {
  if (!html?.trim() || !urls?.length) {
    return html;
  }

  const unicas = [...new Set(urls.filter(Boolean))].filter((url) => !html.includes(url));
  if (!unicas.length) {
    return html;
  }

  const alt = escaparHtml(titulo);
  const figures = unicas
    .map(
      (url) =>
        `<figure class="imagen-galeria"><img src="${url}" alt="${alt}" loading="lazy" /></figure>`,
    )
    .join('');

  const galeria = `<section class="galeria-nota">${figures}</section>`;

  if (/<\/article>/i.test(html)) {
    return html.replace(/<\/article>/i, `${galeria}</article>`);
  }

  return `${html}${galeria}`;
}

export function extraerUrlsImagenesContenido(html) {
  if (!html) return [];

  const urls = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match = imgRegex.exec(html);

  while (match) {
    urls.push(match[1]);
    match = imgRegex.exec(html);
  }

  return urls;
}

/**
 * Elimina figuras/imágenes cuya URL no está en urlsPermitidas.
 * Si urlsPermitidas es un array vacío, quita todas las imágenes del cuerpo.
 */
export function filtrarImagenesPorSeleccion(html, urlsPermitidas) {
  if (!html) return html;

  if (!Array.isArray(urlsPermitidas)) {
    return quitarImagenesGaleria(html);
  }

  let resultado = html;

  resultado = resultado.replace(/<figure[\s\S]*?<\/figure>/gi, (figure) => {
    const srcMatch = figure.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (!srcMatch) return figure;
    return urlEnListaImagenes(srcMatch[1], urlsPermitidas) ? figure : '';
  });

  resultado = resultado.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) return tag;
    return urlEnListaImagenes(srcMatch[1], urlsPermitidas) ? tag : '';
  });

  resultado = resultado.replace(/\[IMAGEN_\d+\]/gi, '');
  return quitarImagenesGaleria(resultado).trim();
}

/** Pipeline único: sin galería final, solo imágenes marcadas en el dashboard. */
export function prepararContenidoConImagenesSeleccionadas(
  html,
  urlsCuerpo,
  titulo,
) {
  let contenido = quitarImagenesGaleria(quitarImagenIncrustada(html));
  contenido = filtrarImagenesPorSeleccion(
    contenido,
    Array.isArray(urlsCuerpo) ? urlsCuerpo : [],
  );
  contenido = inyectarImagenesContextuales(contenido, urlsCuerpo, titulo);
  return quitarImagenesGaleria(contenido);
}

/**
 * Intercala fotos en marcadores [IMAGEN_X] o entre párrafos del cuerpo.
 * Nunca añade galería al final ni deja imágenes después de </article>.
 */
export function inyectarImagenesContextuales(html, imagenesUrls, titulo) {
  let contenido = quitarImagenesGaleria(html || '');

  const urls = [...new Set((imagenesUrls || []).filter(Boolean))];
  if (!urls.length) {
    return contenido.replace(/\[IMAGEN_\d+\]/gi, '').trim();
  }

  const alt = escaparAttrHtml(titulo);
  let fallbackIndex = 0;

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    const marcador = `[IMAGEN_${index + 1}]`;
    const tagImagen =
      `<figure class="wp-block-image size-large">` +
      `<img src="${url}" alt="${alt}" class="wp-image-auto"/>` +
      `</figure>`;

    if (contenido.includes(marcador)) {
      contenido = contenido.replace(marcador, tagImagen);
      continue;
    }

    if (urls.some((u) => contenido.includes(u))) {
      const yaPresente = urlEnListaImagenes(url, extraerUrlsImagenesContenido(contenido));
      if (yaPresente) continue;
    }

    const limiteArticle = contenido.search(/<\/article>/i);
    const cuerpo =
      limiteArticle === -1 ? contenido : contenido.slice(0, limiteArticle);
    const cola =
      limiteArticle === -1 ? '' : contenido.slice(limiteArticle);

    const partes = cuerpo.split('</p>');
    if (partes.length <= 2) {
      continue;
    }

    const pos = Math.min(fallbackIndex * 2 + 1, partes.length - 2);
    partes[pos] = `${partes[pos]}\n${tagImagen}`;
    contenido = `${partes.join('</p>')}${cola}`;
    fallbackIndex += 1;
  }

  contenido = contenido.replace(/\[IMAGEN_\d+\]/gi, '');
  return quitarImagenesGaleria(quitarImagenesFueraDeArticle(contenido)).trim();
}

export function inyectarEmailNotificacionEnContenido(html, email, prefijo) {
  if (!html?.trim() || !email?.trim() || !prefijo) {
    return html;
  }

  const marker = `<!-- ${prefijo}:${email.trim()} -->`;
  if (html.includes(marker) || html.includes(`${prefijo}:`)) {
    return html;
  }

  if (/<\/article>/i.test(html)) {
    return html.replace(/<\/article>/i, `${marker}</article>`);
  }

  return `${html}${marker}`;
}
