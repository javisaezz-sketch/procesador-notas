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

  return /^(re|fw|fwd|rv|res):\s*/i.test(valor)
    || valor.length < 4
    || /^sin asunto$/i.test(valor)
    || /^enlace sin foto\b/i.test(valor);
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
    lower.includes('google.com/maps') ||
    lower.includes('maps.google.') ||
    lower.includes('maps.app.goo.gl') ||
    lower.includes('goo.gl/maps') ||
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

function textoPlanoHtml(fragmento) {
  if (!fragmento) return '';
  return load(`<div>${fragmento}</div>`).text().replace(/\s+/g, ' ').trim();
}

function slugDeUrl(url) {
  try {
    const slug = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) || '');
    if (!/^[a-z0-9-]{8,}$/i.test(slug)) return null;
    return slug;
  } catch {
    return null;
  }
}

function imagenesDeEntradaWordPress(post) {
  const urls = [];
  const add = (valor) => {
    const imagen = String(valor || '').trim();
    if (imagen.startsWith('http') && !urls.includes(imagen)) urls.push(imagen);
  };

  const media = post?._embedded?.['wp:featuredmedia']?.[0];
  add(media?.source_url);
  add(media?.media_details?.sizes?.full?.source_url);
  add(media?.media_details?.sizes?.large?.source_url);

  const og = post?.yoast_head_json?.og_image;
  if (Array.isArray(og)) {
    for (const item of og) add(item?.url);
  }

  return urls;
}

async function leerEntradaWordPress(url) {
  const slug = slugDeUrl(url);
  if (!slug) return null;

  let origen;
  try {
    origen = new URL(url).origin;
  } catch {
    return null;
  }

  try {
    const response = await fetch(
      `${origen}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=1`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        redirect: 'follow',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) return null;
    const tipo = response.headers.get('content-type') || '';
    if (!tipo.includes('json')) return null;

    const lista = await response.json();
    const post = Array.isArray(lista)
      ? lista.find((item) => item?.slug === slug) || lista[0]
      : null;
    if (!post) return null;

    const html = post.content?.rendered || '';
    return {
      titulo: textoPlanoHtml(post.title?.rendered || ''),
      html,
      texto: textoPlanoHtml(html),
      imagenes: imagenesDeEntradaWordPress(post),
    };
  } catch {
    return null;
  }
}

async function fetchPagina(url) {
  const intentos = [
    {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    },
    {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9',
    },
  ];

  let ultimoError = null;

  for (const headers of intentos) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, {
        headers,
        redirect: 'follow',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new Error('La URL no devolvió HTML');
      }

      const html = await response.text();
      if (html.length > MAX_BODY_FETCH) {
        throw new Error('Página demasiado grande');
      }
      if (/just a moment|cf-browser-verification|attention required/i.test(html.slice(0, 2500))) {
        throw new Error('HTTP 403');
      }

      return html;
    } catch (error) {
      ultimoError = error;
      const estado = error.status || 0;
      if (estado && estado !== 401 && estado !== 403 && estado !== 429 && estado !== 503) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw ultimoError || new Error('No se pudo leer la página');
}

export async function extraerContenidoDesdeUrl(url, { maxImagenes = 3 } = {}) {
  const urlNormalizada = limpiarUrl(url);
  let html = '';
  let errorPagina = null;

  try {
    html = await fetchPagina(urlNormalizada);
  } catch (error) {
    errorPagina = error;
  }

  let wp = null;
  if (!html) {
    wp = await leerEntradaWordPress(urlNormalizada);
    if (!wp?.texto && !wp?.imagenes?.length) {
      throw errorPagina || new Error('No se pudo leer la página');
    }
    html = `<article>${wp.html || ''}</article>`;
  }

  const $ = load(html);

  let titulo = extraerTitulo($) || wp?.titulo || null;
  const descripcion = extraerDescripcion($);
  let texto = extraerTextoArticulo($, descripcion);
  const htmlArticulo = extraerHtmlArticulo($) || wp?.html || null;
  let candidatasImagen = recolectarUrlsImagenesPagina($, html, urlNormalizada);

  if (wp?.imagenes?.length) {
    candidatasImagen = [
      ...wp.imagenes,
      ...candidatasImagen.filter((item) => !wp.imagenes.includes(item)),
    ];
  }

  let imagenesDescargadas = await descargarMejoresImagenesRemotas(
    candidatasImagen,
    { max: maxImagenes, prefijo: 'url', referer: urlNormalizada },
  );

  if (!imagenesDescargadas.length || !texto || texto.length < 80) {
    wp = wp || await leerEntradaWordPress(urlNormalizada);
    if (wp?.imagenes?.length && !imagenesDescargadas.length) {
      candidatasImagen = [
        ...wp.imagenes,
        ...candidatasImagen.filter((item) => !wp.imagenes.includes(item)),
      ];
      imagenesDescargadas = await descargarMejoresImagenesRemotas(
        wp.imagenes,
        { max: maxImagenes, prefijo: 'url', referer: urlNormalizada },
      );
    }
    if ((!texto || texto.length < 80) && wp?.texto?.length >= 80) {
      texto = wp.texto;
    }
    if (!titulo && wp?.titulo) titulo = wp.titulo;
  }

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
