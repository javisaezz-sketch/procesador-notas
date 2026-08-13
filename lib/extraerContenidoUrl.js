import { load } from 'cheerio';
import {
  descargarImagenRemota,
  extraerUrlsImagenesHtml,
} from './extraerImagenesEmail.js';

const USER_AGENT = 'Mozilla/5.0 (compatible; ProcesadorNotas/1.0)';
const MAX_BODY_FETCH = 5 * 1024 * 1024;

function limpiarTexto(texto) {
  return (texto || '').replace(/\r\n/g, '\n').trim();
}

function limpiarUrl(url) {
  return String(url || '')
    .trim()
    .replace(/[.,;:!?)]+$/g, '');
}

function resolverUrl(src, baseUrl) {
  if (!src) return null;

  try {
    return new URL(src, baseUrl).href;
  } catch {
    return null;
  }
}

function htmlATexto(html) {
  if (!html) return '';
  const $ = load(html);
  return $.text().replace(/\s+/g, ' ').trim();
}

function extraerUrlsDeContenido(texto, html) {
  const urls = new Set();
  const regex = /https?:\/\/[^\s<>"')\]]+/gi;

  for (const match of (texto || '').matchAll(regex)) {
    urls.add(limpiarUrl(match[0]));
  }

  if (html) {
    for (const match of html.matchAll(regex)) {
      urls.add(limpiarUrl(match[0]));
    }

    const $ = load(html);
    $('a[href^="http"]').each((_, element) => {
      const href = limpiarUrl($(element).attr('href'));
      if (href) urls.add(href);
    });
  }

  return [...urls];
}

function esAsuntoGenerico(asunto) {
  const valor = limpiarTexto(asunto);
  if (!valor) return true;

  return /^(re|fw|fwd|rv|res):\s*/i.test(valor) || valor.length < 4;
}

function esEmailSoloEnlace(texto, html, { tieneAdjuntos = false } = {}) {
  if (tieneAdjuntos) return null;

  const cuerpo = limpiarTexto(texto) || htmlATexto(html);
  if (!cuerpo) return null;

  const urls = extraerUrlsDeContenido(cuerpo, html);
  if (urls.length !== 1) return null;

  const [url] = urls;
  let resto = cuerpo.split(url).join(' ');
  resto = resto
    .replace(/^(re|fw|fwd|rv|res):\s*/gi, '')
    .replace(
      /^(mira|enlace|link|artículo|articulo|nota|url|web|página|pagina)\s*[:\-]?\s*/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (resto.length <= 60) {
    return url;
  }

  return null;
}

function extraerTitulo($) {
  return (
    limpiarTexto($('meta[property="og:title"]').attr('content')) ||
    limpiarTexto($('meta[name="twitter:title"]').attr('content')) ||
    limpiarTexto($('title').first().text()) ||
    null
  );
}

function extraerDescripcion($) {
  return (
    limpiarTexto($('meta[property="og:description"]').attr('content')) ||
    limpiarTexto($('meta[name="description"]').attr('content')) ||
    null
  );
}

function extraerImagenPrincipal($, html, baseUrl) {
  const metaCandidates = [
    $('meta[property="og:image"]').attr('content'),
    $('meta[property="og:image:url"]').attr('content'),
    $('meta[name="twitter:image"]').attr('content'),
    $('link[rel="image_src"]').attr('href'),
  ];

  for (const candidate of metaCandidates) {
    const resolved = resolverUrl(candidate, baseUrl);
    if (resolved) return resolved;
  }

  const desdeHtml = extraerUrlsImagenesHtml(html);
  return desdeHtml[0] ?? null;
}

function extraerHtmlArticulo($) {
  const selectores = [
    'article',
    'main',
    '[role="main"]',
    '.entry-content',
    '.post-content',
    '.article-content',
    '.article-body',
    '.content',
    '#content',
  ];

  for (const selector of selectores) {
    const element = $(selector).first();
    if (element.length && element.text().trim().length > 200) {
      return element.html() || null;
    }
  }

  const body = $('body').clone();
  body.find('script, style, nav, footer, header, aside, noscript, iframe').remove();
  const html = body.html();
  return html?.trim() ? html : null;
}

function extraerTextoArticulo($, descripcion) {
  const selectores = [
    'article',
    'main',
    '[role="main"]',
    '.entry-content',
    '.post-content',
    '.article-content',
    '.article-body',
    '.content',
    '#content',
  ];

  for (const selector of selectores) {
    const element = $(selector).first();
    const texto = element.text().replace(/\s+/g, ' ').trim();
    if (texto.length > 200) {
      return texto;
    }
  }

  const body = $('body').clone();
  body.find('script, style, nav, footer, header, aside, noscript, iframe').remove();
  const bodyText = body.text().replace(/\s+/g, ' ').trim();

  if (bodyText.length > 200) {
    return bodyText;
  }

  if (descripcion && descripcion.length > 80) {
    return descripcion;
  }

  return bodyText || descripcion || '';
}

async function fetchPagina(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error('La URL no devolvió HTML');
    }

    const html = await response.text();
    if (html.length > MAX_BODY_FETCH) {
      throw new Error('Página demasiado grande');
    }

    return html;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extraerContenidoDesdeUrl(url) {
  const urlNormalizada = limpiarUrl(url);
  const html = await fetchPagina(urlNormalizada);
  const $ = load(html);

  const titulo = extraerTitulo($);
  const descripcion = extraerDescripcion($);
  const texto = extraerTextoArticulo($, descripcion);
  const htmlArticulo = extraerHtmlArticulo($);
  const imagenUrl = extraerImagenPrincipal($, html, urlNormalizada);

  if (!texto || texto.length < 80) {
    throw new Error('No se pudo extraer suficiente texto del artículo');
  }

  let imagen = null;

  if (imagenUrl) {
    try {
      const archivo = await descargarImagenRemota(imagenUrl);
      imagen = {
        ...archivo,
        filename: `url-${Date.now()}.${archivo.filename.split('.').pop() || 'jpg'}`,
        origen: 'url',
      };
    } catch {
      imagen = null;
    }
  }

  const contenidoOriginal = [
    `Fuente: ${urlNormalizada}`,
    titulo ? `\n${titulo}\n` : '',
    texto,
  ]
    .join('')
    .trim();

  return {
    url: urlNormalizada,
    titulo,
    texto: contenidoOriginal,
    html: htmlArticulo || html,
    imagen,
  };
}

export function esNotaDesdeUrl(nota) {
  if (!nota) return false;

  const contenido = String(nota.contenido_original || '').trim();
  return /^Fuente:\s*https?:\/\//i.test(contenido);
}

export {
  esAsuntoGenerico,
  esEmailSoloEnlace,
  extraerUrlsDeContenido,
  limpiarTexto,
};
