import { createSupabaseAdmin, subirImagenNota } from './ingestNota.js';
import { descargarImagen, obtenerExtensionDesdeUrl } from './imagenes.js';

const NAVEGADOR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export function esUrlImagenBasura(url) {
  const lower = String(url || '').toLowerCase();

  if (!lower.startsWith('http')) return true;

  return (
    lower.includes('/pixel') ||
    lower.includes('pixel.gif') ||
    lower.includes('pixel.png') ||
    lower.includes('tracker') ||
    lower.includes('spacer') ||
    lower.includes('1x1') ||
    lower.includes('facebook.com/tr') ||
    lower.includes('gravatar.com') ||
    lower.includes('doubleclick') ||
    lower.includes('google-analytics') ||
    lower.includes('googletagmanager') ||
    lower.includes('wp-emoji') ||
    lower.includes('wp-smiley') ||
    lower.includes('loading.gif') ||
    lower.includes('/spinner') ||
    lower.includes('data:image') ||
    /\/favicon|favicon\.|sprite|badge-|\.svg(\?|#|$)/i.test(lower) ||
    /[-_/](1|8|16|24|32|48)x(1|8|16|24|32|48)(\.|[-_/]|$)/i.test(lower)
  );
}

function esUrlBasura(url) {
  return esUrlImagenBasura(url);
}

export function resolverUrlImagen(src, baseUrl) {
  if (!src) return null;
  const limpia = String(src).trim();
  if (!limpia || limpia.startsWith('data:')) return null;

  try {
    return new URL(limpia, baseUrl).href;
  } catch {
    return null;
  }
}

function extraerUrlsDesdeSrcset(srcset, baseUrl) {
  if (!srcset) return [];

  return srcset
    .split(',')
    .map((part) => {
      const bits = part.trim().split(/\s+/);
      const ancho = Number(String(bits[1] || '').replace(/w$/i, '')) || 0;
      return {
        url: resolverUrlImagen(bits[0], baseUrl),
        ancho,
      };
    })
    .filter((item) => item.url);
}

function puntuarUrlImagen(url, { origen = 'html', ancho = 0, alto = 0, enArticulo = false, bonus = 0 } = {}) {
  if (esUrlImagenBasura(url)) return -1000;

  let score = 20 + Number(bonus || 0);
  const lower = url.toLowerCase();

  if (origen === 'og') score += 120;
  if (origen === 'twitter') score += 110;
  if (origen === 'jsonld') score += 105;
  if (origen === 'srcset') score += 40;
  if (enArticulo) score += 55;

  const lado = Math.max(Number(ancho) || 0, Number(alto) || 0);
  if (lado >= 1200) score += 45;
  else if (lado >= 800) score += 35;
  else if (lado >= 400) score += 25;
  else if (lado >= 200) score += 10;
  else if (lado > 0 && lado < 120) score -= 50;

  if (/hero|featured|destacad|principal|cover|cabecera|header-image|post-thumbnail/i.test(lower)) {
    score += 30;
  }

  if (/(^|[^\w])(thumb|mini|avatar|icon|logo|badge|sprite|emoji|advert|banner-ad)([^\w]|$)/i.test(lower)) {
    score -= 90;
  }

  return score;
}

function variantesAltaResolucion(url) {
  const variantes = [];
  const sinTamanoWp = url.replace(
    /-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp|gif|avif)(?:\?|#|$))/i,
    '',
  );
  if (sinTamanoWp !== url) variantes.push(sinTamanoWp);

  try {
    const parsed = new URL(url);
    if (parsed.pathname.includes('/_next/image')) {
      const inner = parsed.searchParams.get('url');
      if (inner) {
        variantes.push(inner.startsWith('http') ? inner : new URL(inner, parsed.origin).href);
      }
    }
    let cambio = false;
    for (const key of ['w', 'width']) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, '2000');
        cambio = true;
      }
    }
    if (cambio) variantes.push(parsed.href);
  } catch {
    // La URL original sigue siendo válida
  }

  return variantes;
}

function registrarCandidata(mapa, url, meta = {}) {
  const resolved = resolverUrlImagen(url, meta.baseUrl);
  if (!resolved || esUrlImagenBasura(resolved)) return;

  const score = puntuarUrlImagen(resolved, meta);
  const prev = mapa.get(resolved);

  if (!prev || score > prev.score) {
    mapa.set(resolved, { url: resolved, score, origen: meta.origen || 'html' });
  }

  if (meta.sinVariantes) return;

  for (const variante of variantesAltaResolucion(resolved)) {
    registrarCandidata(mapa, variante, {
      ...meta,
      sinVariantes: true,
      bonus: (meta.bonus || 0) + 25,
    });
  }
}

function anadirImagenJson(valor, baseUrl, mapa) {
  if (!valor) return;
  if (typeof valor === 'string') {
    registrarCandidata(mapa, valor, { baseUrl, origen: 'jsonld' });
    return;
  }
  if (Array.isArray(valor)) {
    for (const item of valor) anadirImagenJson(item, baseUrl, mapa);
    return;
  }
  if (typeof valor === 'object') {
    anadirImagenJson(valor.url, baseUrl, mapa);
    anadirImagenJson(valor.contentUrl, baseUrl, mapa);
  }
}

function visitarNodoJson(node, baseUrl, mapa, depth = 0) {
  if (!node || depth > 8) return;
  if (Array.isArray(node)) {
    for (const item of node) visitarNodoJson(item, baseUrl, mapa, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;

  if (node['@graph']) visitarNodoJson(node['@graph'], baseUrl, mapa, depth + 1);
  anadirImagenJson(node.image, baseUrl, mapa);
  anadirImagenJson(node.thumbnailUrl, baseUrl, mapa);

  const tipo = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '');
  if (/ImageObject/i.test(tipo)) {
    anadirImagenJson(node.url || node.contentUrl, baseUrl, mapa);
  }
}

function extraerImagenesJsonLd($, baseUrl, mapa) {
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).html();
    if (!raw?.trim()) return;

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    visitarNodoJson(parsed, baseUrl, mapa);
  });
}

function extraerImagenesMeta($, baseUrl, mapa) {
  const metas = [
    ['meta[property="og:image:secure_url"]', 'og'],
    ['meta[property="og:image"]', 'og'],
    ['meta[property="og:image:url"]', 'og'],
    ['meta[name="twitter:image"]', 'twitter'],
    ['meta[name="twitter:image:src"]', 'twitter'],
    ['meta[property="twitter:image"]', 'twitter'],
    ['meta[itemprop="image"]', 'og'],
    ['link[rel="image_src"]', 'og'],
    ['link[rel="preload"][as="image"]', 'og'],
  ];

  for (const [selector, origen] of metas) {
    $(selector).each((_, element) => {
      const valor = $(element).attr('content') || $(element).attr('href');
      registrarCandidata(mapa, valor, { baseUrl, origen });
    });
  }
}

function extraerImagenesElemento($, element, baseUrl, mapa, { enArticulo = false } = {}) {
  const $el = $(element);
  const attrs = [
    $el.attr('src'),
    $el.attr('data-src'),
    $el.attr('data-lazy-src'),
    $el.attr('data-lazy'),
    $el.attr('data-original'),
    $el.attr('data-orig-file'),
    $el.attr('data-large-file'),
    $el.attr('data-full-url'),
    $el.attr('data-hi-res-src'),
    $el.attr('data-image'),
    $el.attr('data-zoom-image'),
    $el.attr('nitro-lazy-src'),
    $el.attr('poster'),
  ];

  for (const attr of attrs) {
    if (!attr) continue;

    if (attr.includes(',')) {
      for (const item of extraerUrlsDesdeSrcset(attr, baseUrl)) {
        registrarCandidata(mapa, item.url, {
          baseUrl,
          origen: 'srcset',
          ancho: item.ancho || Number($el.attr('width') || 0),
          alto: Number($el.attr('height') || 0),
          enArticulo,
        });
      }
      continue;
    }

    registrarCandidata(mapa, attr, {
      baseUrl,
      ancho: Number($el.attr('width') || 0),
      alto: Number($el.attr('height') || 0),
      enArticulo,
    });
  }

  for (const srcset of [$el.attr('srcset'), $el.attr('data-srcset'), $el.attr('data-lazy-srcset')]) {
    if (!srcset) continue;
    for (const item of extraerUrlsDesdeSrcset(srcset, baseUrl)) {
      registrarCandidata(mapa, item.url, {
        baseUrl,
        origen: 'srcset',
        ancho: item.ancho || Number($el.attr('width') || 0),
        alto: Number($el.attr('height') || 0),
        enArticulo,
      });
    }
  }
}

export function recolectarUrlsImagenesPagina($, html, baseUrl) {
  const mapa = new Map();

  extraerImagenesMeta($, baseUrl, mapa);
  extraerImagenesJsonLd($, baseUrl, mapa);

  const selectoresArticulo = [
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

  for (const selector of selectoresArticulo) {
    $(selector)
      .find('img')
      .each((_, element) => {
        extraerImagenesElemento($, element, baseUrl, mapa, { enArticulo: true });
      });
  }

  $('picture source[srcset], picture source[data-srcset], picture source[src]').each((_, element) => {
    const src = $(element).attr('src');
    const srcset = $(element).attr('srcset') || $(element).attr('data-srcset');
    if (src) registrarCandidata(mapa, src, { baseUrl, origen: 'srcset', enArticulo: true });
    if (srcset) {
      for (const item of extraerUrlsDesdeSrcset(srcset, baseUrl)) {
        registrarCandidata(mapa, item.url, {
          baseUrl,
          origen: 'srcset',
          ancho: item.ancho,
          enArticulo: true,
        });
      }
    }
  });

  $('img, amp-img').each((_, element) => {
    extraerImagenesElemento($, element, baseUrl, mapa, { enArticulo: false });
  });

  if (html) {
    for (const url of extraerUrlsImagenesHtml(html)) {
      registrarCandidata(mapa, url, { baseUrl, origen: 'html' });
    }
    for (const url of extraerUrlsImagenEnBruto(html)) {
      registrarCandidata(mapa, url, { baseUrl, origen: 'html' });
    }
  }

  return [...mapa.values()]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.url);
}

export async function descargarMejoresImagenesRemotas(urls, { max = 3, prefijo = 'url', referer = null } = {}) {
  const descargadas = [];
  const unicas = [...new Set(urls.filter(Boolean))];
  const maxIntentos = 16;
  let intentos = 0;

  for (const url of unicas) {
    if (descargadas.length >= max || intentos >= maxIntentos) break;
    intentos += 1;

    try {
      const archivo = await descargarImagenRemota(url, { referer });
      descargadas.push({
        ...archivo,
        filename: `${prefijo}-${Date.now()}-${descargadas.length + 1}.${(archivo.filename.split('.').pop() || 'jpg')}`,
        origen: 'url',
      });
    } catch (error) {
      console.warn(`[imagenes] No se pudo descargar ${url}: ${error.message}`);
    }
  }

  return descargadas;
}

export function extraerUrlsImagenesHtml(html) {
  if (!html) return [];

  const urls = new Set();
  const attrRegex =
    /(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["']/gi;
  let match = attrRegex.exec(html);

  while (match) {
    const src = match[1].trim();
    if (src.startsWith('http') && !esUrlBasura(src)) {
      urls.add(src);
    }
    match = attrRegex.exec(html);
  }

  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  match = srcsetRegex.exec(html);
  while (match) {
    for (const part of match[1].split(',')) {
      const src = part.trim().split(/\s+/)[0];
      if (src?.startsWith('http') && !esUrlBasura(src)) {
        urls.add(src);
      }
    }
    match = srcsetRegex.exec(html);
  }

  const bgRegex = /url\(["']?(https?:[^"')]+)["']?\)/gi;
  match = bgRegex.exec(html);
  while (match) {
    if (!esUrlBasura(match[1])) urls.add(match[1].trim());
    match = bgRegex.exec(html);
  }

  return [...urls];
}

function extraerUrlsImagenEnBruto(html) {
  if (!html) return [];

  const plano = html
    .replace(/\\u0026/gi, '&')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');

  const urls = new Set();
  const regex = /https?:\/\/[^"'\\\s<>]+?\.(?:jpe?g|png|webp|gif|avif)(?:\?[^"'\\\s<>]*)?/gi;
  for (const match of plano.matchAll(regex)) {
    urls.add(match[0]);
  }
  return [...urls];
}

function bufferEsImagen(buffer, contentType, url) {
  const tipo = String(contentType || '').toLowerCase();
  if (tipo.startsWith('text/') || tipo.includes('html') || tipo.includes('json')) return false;
  if (tipo.startsWith('image/')) return true;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) return true;
  if (buffer.length >= 8 && buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a') return true;
  if (buffer.length >= 12 && buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') {
    return true;
  }
  if (buffer.length >= 4 && buffer.slice(0, 3).toString() === 'GIF') return true;
  return /\.(?:jpe?g|png|webp|gif|avif)(?:\?|#|$)/i.test(url) && !tipo;
}

async function descargarUnaVez(url, headersExtra) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': NAVEGADOR,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      ...headersExtra,
    },
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!bufferEsImagen(buffer, contentType, url)) {
    throw new Error('No es una imagen');
  }
  if (buffer.length < 2000) {
    throw new Error('Imagen demasiado pequeña');
  }

  const extension = obtenerExtensionDesdeUrl(url, contentType || 'image/jpeg');
  return {
    buffer,
    contentType: contentType.startsWith('image/') ? contentType : 'image/jpeg',
    filename: `incrustada.${extension}`,
  };
}

export async function descargarImagenRemota(url, { referer } = {}) {
  const cabeceras = [];
  if (referer) cabeceras.push({ Referer: referer });
  try {
    const origen = new URL(url).origin;
    cabeceras.push({ Referer: `${origen}/` });
  } catch {
    // Sin origen no hay segundo intento
  }
  cabeceras.push({});

  let ultimoError = null;
  const vistos = new Set();
  for (const extra of cabeceras) {
    const clave = extra.Referer || '';
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    try {
      return await descargarUnaVez(url, extra);
    } catch (error) {
      ultimoError = error;
      if (error.status && error.status !== 401 && error.status !== 403 && error.status !== 429) {
        throw error;
      }
    }
  }

  throw ultimoError || new Error('No se pudo descargar la imagen');
}

const MAX_IMAGENES_HTML = Number(process.env.MAX_IMAGENES_HTML ?? 5);
export const MAX_FOTOS_NOTA = 10;

export function listarUrlsImagenDirecta(texto, html) {
  const urls = new Set();
  const regex = /https?:\/\/[^\s<>"')\]]+/gi;

  for (const fuente of [texto, html]) {
    if (!fuente) continue;
    for (const match of String(fuente).matchAll(regex)) {
      const url = match[0].replace(/[.,;:!?)]+$/g, '').replace(/&amp;/g, '&');
      if (/\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(url) && !esUrlImagenBasura(url)) {
        urls.add(url);
      }
    }
  }

  return [...urls];
}

export async function guardarImagenesDesdeHtml(supabase, notaId, html, { max } = {}) {
  const limite = max == null ? MAX_IMAGENES_HTML : Number(max);
  const urls = extraerUrlsImagenesHtml(html).slice(0, limite);
  const guardadas = [];

  for (const url of urls) {
    try {
      const archivo = await descargarImagenRemota(url);
      const publicUrl = await subirImagenNota(supabase, notaId, {
        ...archivo,
        origen: 'html',
      });
      guardadas.push(publicUrl);
    } catch {
      // Ignorar imágenes que no se puedan descargar
    }
  }

  return guardadas;
}

export async function reextraerImagenesNota(notaId) {
  const supabase = createSupabaseAdmin();

  const { data: nota, error } = await supabase
    .from('notas_prensa')
    .select('id, contenido_html')
    .eq('id', notaId)
    .single();

  if (error || !nota) {
    throw new Error('Nota no encontrada');
  }

  if (!nota.contenido_html) {
    throw new Error('La nota no tiene contenido HTML');
  }

  return guardarImagenesDesdeHtml(supabase, nota.id, nota.contenido_html);
}
