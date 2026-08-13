function escaparHtml(texto = '') {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

export function quitarImagenesGaleria(html) {
  if (!html) return html;

  return html
    .replace(/<section[^>]*class=["'][^"']*galeria-nota[^"']*["'][^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<figure[^>]*class=["'][^"']*imagen-galeria[^"']*["'][^>]*>[\s\S]*?<\/figure>/gi, '')
    .trim();
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
