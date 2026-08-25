import { createSupabaseAdmin, subirImagenNota } from './ingestNota.js';
import { descargarImagen, obtenerExtensionDesdeUrl } from './imagenes.js';

export function esUrlImagenBasura(url) {
  const lower = String(url || '').toLowerCase();

  if (!lower.startsWith('http')) return true;

  return (
    lower.includes('pixel') ||
    lower.includes('tracker') ||
    lower.includes('spacer') ||
    lower.includes('1x1') ||
    lower.includes('facebook.com') ||
    lower.includes('twitter.com') ||
    lower.includes('linkedin.com') ||
    lower.includes('instagram.com/static') ||
    lower.includes('gravatar.com') ||
    lower.includes('doubleclick') ||
    lower.includes('google-analytics') ||
    lower.includes('wp-emoji') ||
    lower.includes('emoji') ||
    lower.includes('placeholder') ||
    lower.includes('loading.gif') ||
    lower.includes('spinner') ||
    lower.includes('data:image') ||
    /logo|icon|favicon|avatar|badge|sprite|banner-ad|advert/i.test(lower) ||
    /[-_/](16|24|32|48|64|96|128)x(16|24|32|48|64|96|128)(\.|[-_/]|$)/i.test(lower) ||
    lower.endsWith('.svg') ||
    lower.endsWith('.gif')
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
    .map((part) => part.trim().split(/\s+/)[0])
    .map((src) => resolverUrlImagen(src, baseUrl))
    .filter(Boolean);
}

function puntuarUrlImagen(url, { origen = 'html', ancho = 0, alto = 0, enArticulo = false } = {}) {
  if (esUrlImagenBasura(url)) return -1000;

  let score = 0;
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
  else if (lado > 0 && lado < 120) score -= 40;

  if (/hero|featured|destacad|principal|cover|cabecera|header-image|post-thumbnail/i.test(lower)) {
    score += 30;
  }

  if (/thumb|mini|small|tiny|avatar|icon|logo|badge|emoji|wp-smiley/i.test(lower)) {
    score -= 80;
  }

  return score;
}

function registrarCandidata(mapa, url, meta = {}) {
  const resolved = resolverUrlImagen(url, meta.baseUrl);
  if (!resolved || esUrlImagenBasura(resolved)) return;

  const score = puntuarUrlImagen(resolved, meta);
  const prev = mapa.get(resolved);

  if (!prev || score > prev.score) {
    mapa.set(resolved, { url: resolved, score, origen: meta.origen || 'html' });
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

    const items = Array.isArray(parsed) ? parsed : [parsed];

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      const imagenes = [];

      if (typeof item.image === 'string') imagenes.push(item.image);
      else if (Array.isArray(item.image)) imagenes.push(...item.image);
      else if (item.image?.url) imagenes.push(item.image.url);

      if (typeof item.thumbnailUrl === 'string') imagenes.push(item.thumbnailUrl);

      for (const imagen of imagenes) {
        const url = typeof imagen === 'string' ? imagen : imagen?.url;
        registrarCandidata(mapa, url, { baseUrl, origen: 'jsonld' });
      }
    }
  });
}

function extraerImagenesMeta($, baseUrl, mapa) {
  const metas = [
    ['meta[property="og:image:secure_url"]', 'og'],
    ['meta[property="og:image"]', 'og'],
    ['meta[property="og:image:url"]', 'og'],
    ['meta[name="twitter:image"]', 'twitter'],
    ['meta[name="twitter:image:src"]', 'twitter'],
    ['link[rel="image_src"]', 'og'],
  ];

  for (const [selector, origen] of metas) {
    const valor = $(selector).attr('content') || $(selector).attr('href');
    registrarCandidata(mapa, valor, { baseUrl, origen });
  }
}

function extraerImagenesElemento($, element, baseUrl, mapa, { enArticulo = false } = {}) {
  const $el = $(element);
  const attrs = [
    $el.attr('src'),
    $el.attr('data-src'),
    $el.attr('data-lazy-src'),
    $el.attr('data-original'),
    $el.attr('data-srcset'),
  ];

  for (const attr of attrs) {
    if (!attr) continue;

    if (attr.includes(',')) {
      for (const url of extraerUrlsDesdeSrcset(attr, baseUrl)) {
        registrarCandidata(mapa, url, {
          baseUrl,
          origen: 'srcset',
          ancho: Number($el.attr('width') || 0),
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

  const srcset = $el.attr('srcset');
  if (srcset) {
    for (const url of extraerUrlsDesdeSrcset(srcset, baseUrl)) {
      registrarCandidata(mapa, url, {
        baseUrl,
        origen: 'srcset',
        ancho: Number($el.attr('width') || 0),
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

  $('picture source[srcset], picture source[src]').each((_, element) => {
    const src = $(element).attr('src');
    const srcset = $(element).attr('srcset');
    if (src) registrarCandidata(mapa, src, { baseUrl, origen: 'srcset', enArticulo: true });
    if (srcset) {
      for (const url of extraerUrlsDesdeSrcset(srcset, baseUrl)) {
        registrarCandidata(mapa, url, { baseUrl, origen: 'srcset', enArticulo: true });
      }
    }
  });

  $('img').each((_, element) => {
    extraerImagenesElemento($, element, baseUrl, mapa, { enArticulo: false });
  });

  if (html) {
    for (const url of extraerUrlsImagenesHtml(html)) {
      registrarCandidata(mapa, url, { baseUrl, origen: 'html' });
    }
  }

  return [...mapa.values()]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.url);
}

export async function descargarMejoresImagenesRemotas(urls, { max = 3, prefijo = 'url' } = {}) {
  const descargadas = [];
  const unicas = [...new Set(urls.filter(Boolean))];

  for (const url of unicas) {
    if (descargadas.length >= max) break;

    try {
      const archivo = await descargarImagenRemota(url);
      descargadas.push({
        ...archivo,
        filename: `${prefijo}-${Date.now()}-${descargadas.length + 1}.${(archivo.filename.split('.').pop() || 'jpg')}`,
        origen: 'url',
      });
    } catch {
      // Probar siguiente candidata
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

export async function descargarImagenRemota(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ProcesadorNotas/1.0)',
      Accept: 'image/*',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error('No es una imagen');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 5000) {
    throw new Error('Imagen demasiado pequeña (posible pixel de tracking)');
  }

  const extension = obtenerExtensionDesdeUrl(url, contentType);
  return {
    buffer,
    contentType,
    filename: `incrustada.${extension}`,
  };
}

const MAX_IMAGENES_HTML = Number(process.env.MAX_IMAGENES_HTML ?? 8);

export async function guardarImagenesDesdeHtml(supabase, notaId, html) {
  const urls = extraerUrlsImagenesHtml(html).slice(0, MAX_IMAGENES_HTML);
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
