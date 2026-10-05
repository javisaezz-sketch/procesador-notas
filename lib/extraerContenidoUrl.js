import { load } from 'cheerio';
import {
  descargarMejoresImagenesRemotas,
  listarUrlsImagenDirecta,
  recolectarUrlsImagenesPagina,
} from './extraerImagenesEmail.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_BODY_FETCH = 5 * 1024 * 1024;

function limpiarTexto(texto) {
  return (texto || '').replace(/\r\n/g, '\n').trim();
}

function limpiarUrl(url) {
  return String(url || '')
    .trim()
    .replace(/[.,;:!?)]+$/g, '');
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

  return /^(re|fw|fwd|rv|res):\s*/i.test(valor) || valor.length < 4 || /^sin asunto$/i.test(valor);
}

export function esUrlExcluidaScraping(url) {
  const lower = String(url || '').toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return true;

  return (
    lower.includes('facebook.com') ||
    lower.includes('twitter.com') ||
    lower.includes('x.com') ||
    lower.includes('instagram.com') ||
    lower.includes('linkedin.com') ||
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.includes('tiktok.com') ||
    lower.includes('pinterest.com') ||
    lower.includes('whatsapp.com') ||
    lower.includes('wa.me') ||
    lower.includes('t.me') ||
    lower.includes('schema.org') ||
    lower.includes('w3.org') ||
    lower.includes('doubleclick') ||
    lower.includes('google-analytics') ||
    lower.includes('googletagmanager') ||
    lower.includes('mailchimp') ||
    lower.includes('list-manage') ||
    lower.includes('unsubscribe') ||
    /\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mp3)(\?|$)/i.test(lower)
  );
}

export function detectarUrlEnlaceEmail(texto, html) {
  const cuerpo = limpiarTexto(texto) || htmlATexto(html);
  if (!cuerpo) return null;

  const todasUrls = extraerUrlsDeContenido(cuerpo, html);
  const urlsValidas = todasUrls.filter((u) => !esUrlExcluidaScraping(u));

  if (urlsValidas.length === 0) return null;

  const url = urlsValidas[0];

  let resto = cuerpo.split(url).join(' ');
  resto = resto
    .replace(/^(re|fw|fwd|rv|res):\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Si el cuerpo del email sin la URL es excesivamente largo (> 1500 caracteres),
  // se trata de una nota de prensa completa que ya contiene todo el contenido en el email.
  if (resto.length > 1500) {
    return null;
  }

  const restoSinBoilerplate = resto
    .replace(
      /^(mira(\s+(esto|este\s+(enlace|link|artículo|articulo|post)))?|(te\s+paso|os\s+paso|comparto|adjunto)\s+(este\s+)?(enlace|link|artículo|articulo|url)|enlace|link|artículo|articulo|nota|url|web|página|pagina|fuente|info|aquí|aqui)\s*[:\-]?\s*/gi,
      '',
    )
    .trim();

  return {
    url,
    instrucciones: restoSinBoilerplate.length > 5 ? resto : null,
  };
}

function esEmailSoloEnlace(texto, html, { tieneAdjuntos = false } = {}) {
  if (tieneAdjuntos) return null;
  const detectado = detectarUrlEnlaceEmail(texto, html);
  return detectado ? detectado.url : null;
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
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
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

export async function extraerContenidoDesdeUrl(url, { maxImagenes = 3 } = {}) {
  const urlNormalizada = limpiarUrl(url);
  const html = await fetchPagina(urlNormalizada);
  const $ = load(html);

  const titulo = extraerTitulo($);
  const descripcion = extraerDescripcion($);
  const texto = extraerTextoArticulo($, descripcion);
  const htmlArticulo = extraerHtmlArticulo($);
  const candidatasImagen = recolectarUrlsImagenesPagina($, html, urlNormalizada);
    const imagenesDescargadas = await descargarMejoresImagenesRemotas(
    candidatasImagen,
    { max: maxImagenes, prefijo: 'url', referer: urlNormalizada },
  );

  if (!texto || texto.length < 80) {
    throw new Error('No se pudo extraer suficiente texto del artículo');
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
    imagenesDescargadas,
    imagen: imagenesDescargadas[0] ?? null,
    candidatasImagen,
  };
}

export async function completarImagenesDesdeTexto(
  texto,
  html,
  { max = 10, omitirUrls = [] } = {},
) {
  const descargadas = [];
  const omitidas = new Set(omitirUrls.filter(Boolean).map((url) => limpiarUrl(url)));

  const directas = listarUrlsImagenDirecta(texto, html).filter((url) => !omitidas.has(url));
  if (directas.length) {
    descargadas.push(
      ...(await descargarMejoresImagenesRemotas(directas, {
        max,
        prefijo: 'mail',
      })),
    );
  }

  const paginas = extraerUrlsDeContenido(texto || '', html || '')
    .map((url) => limpiarUrl(url))
    .filter((url) => url && !omitidas.has(url) && !esUrlExcluidaScraping(url))
    .slice(0, 3);

  for (const url of paginas) {
    if (descargadas.length >= max) break;
    try {
      const htmlPagina = await fetchPagina(url);
      const $ = load(htmlPagina);
      const candidatas = recolectarUrlsImagenesPagina($, htmlPagina, url);
      const lote = await descargarMejoresImagenesRemotas(candidatas, {
        max: max - descargadas.length,
        prefijo: 'url',
        referer: url,
      });
      descargadas.push(...lote);
    } catch {
      // El siguiente enlace puede traer la foto
    }
  }

  return descargadas.slice(0, max);
}

export function esNotaDesdeUrl(nota) {
  if (!nota) return false;

  const remitente = String(nota.remitente || '').trim().toLowerCase();
  if (remitente && remitente.includes('@') && remitente !== 'panel@url-ingest') {
    return false;
  }

  if (remitente === 'panel@url-ingest') {
    return true;
  }

  const contenido = String(nota.contenido_original || '').trim();
  return /(?:^|\n)Fuente:\s*https?:\/\//i.test(contenido);
}

export {
  esAsuntoGenerico,
  esEmailSoloEnlace,
  extraerUrlsDeContenido,
  limpiarTexto,
};
