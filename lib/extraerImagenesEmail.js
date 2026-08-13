import { createSupabaseAdmin, subirImagenNota } from './ingestNota.js';
import { descargarImagen, obtenerExtensionDesdeUrl } from './imagenes.js';

function esUrlBasura(url) {
  const lower = url.toLowerCase();
  return (
    lower.includes('pixel') ||
    lower.includes('tracker') ||
    lower.includes('spacer') ||
    lower.includes('1x1') ||
    lower.includes('facebook.com') ||
    lower.includes('twitter.com') ||
    lower.includes('linkedin.com') ||
    lower.includes('instagram.com/static') ||
    lower.endsWith('.svg')
  );
}

export function extraerUrlsImagenesHtml(html) {
  if (!html) return [];

  const urls = new Set();
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match = imgRegex.exec(html);

  while (match) {
    const src = match[1].trim();
    if (src.startsWith('http') && !esUrlBasura(src)) {
      urls.add(src);
    }
    match = imgRegex.exec(html);
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

export async function guardarImagenesDesdeHtml(supabase, notaId, html) {
  const urls = extraerUrlsImagenesHtml(html);
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
