const MIN_ASUNTO_DUPLICADO = 12;

export function normalizarAsunto(asunto) {
  return String(asunto || '')
    .trim()
    .replace(/^(re|fw|fwd|rv|res):\s*/gi, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizarUrlFuente(url) {
  const limpia = String(url || '')
    .trim()
    .replace(/[.,;:!?)]+$/g, '');

  try {
    const parsed = new URL(limpia);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_|^fbclid$|^gclid$/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }

    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.hostname}${path}${parsed.search}`;
  } catch {
    return limpia.toLowerCase();
  }
}

export function extraerUrlsDeTexto(texto, html) {
  const urls = new Set();
  const regex = /https?:\/\/[^\s<>"')\]]+/gi;

  for (const match of String(texto || '').matchAll(regex)) {
    urls.add(normalizarUrlFuente(match[0]));
  }

  if (html) {
    for (const match of String(html).matchAll(regex)) {
      urls.add(normalizarUrlFuente(match[0]));
    }
  }

  return [...urls];
}

export function extraerUrlFuenteNota(contenidoOriginal) {
  const match = String(contenidoOriginal || '').match(/^Fuente:\s*(https?:\/\/\S+)/im);
  if (match) {
    return normalizarUrlFuente(match[1]);
  }

  return null;
}

export function claveBusquedaUrl(url) {
  const normalizada = normalizarUrlFuente(url);

  try {
    const parsed = new URL(normalizada);
    const segmentos = parsed.pathname.split('/').filter(Boolean);
    const ultimo = segmentos.at(-1);

    if (ultimo && ultimo.length >= 6) {
      return ultimo;
    }

    return parsed.pathname.replace(/\/+$/, '');
  } catch {
    return normalizada;
  }
}

function normalizarTexto(contenido) {
  return String(contenido || '')
    .replace(/^Fuente:\s*https?:\/\/\S+\s*/im, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function fragmentoSeguro(texto, longitud = 80) {
  return texto.replace(/[%_\\]/g, ' ').slice(0, longitud).trim();
}

export function contenidoEsSimilar(a, b) {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);

  if (!na || !nb) return false;
  if (na === nb) return true;

  const minLen = Math.min(na.length, nb.length);
  const maxLen = Math.max(na.length, nb.length);

  if (minLen >= 120 && maxLen > 0 && minLen / maxLen >= 0.85) {
    return (
      na.slice(0, minLen) === nb.slice(0, minLen) ||
      na.includes(nb.slice(0, 120)) ||
      nb.includes(na.slice(0, 120))
    );
  }

  return false;
}

export async function buscarNotaDuplicada(
  supabase,
  { medioId, asunto, contenidoOriginal, urls = [], excluirNotaId = null },
) {
  if (!medioId) return null;

  const candidatasUrl = new Set(urls.filter(Boolean));
  const urlFuente = extraerUrlFuenteNota(contenidoOriginal);

  if (urlFuente) {
    candidatasUrl.add(urlFuente);
  }

  for (const url of candidatasUrl) {
    const clave = claveBusquedaUrl(url);
    if (!clave || clave.length < 6) continue;

    const { data: porUrl, error } = await supabase
      .from('notas_prensa')
      .select('id, asunto, remitente, estado, contenido_original')
      .eq('medio_id', medioId)
      .neq('estado', 'descartada')
      .ilike('contenido_original', `%${clave}%`)
      .order('id', { ascending: true })
      .limit(5);

    if (error) continue;

    const existente = (porUrl ?? []).find(
      (nota) => !excluirNotaId || nota.id !== excluirNotaId,
    );

    if (existente) {
      return { nota: existente, motivo: 'misma_url' };
    }
  }

  const asuntoNorm = normalizarAsunto(asunto);

  if (asuntoNorm.length >= MIN_ASUNTO_DUPLICADO) {
    const { data: porAsunto, error } = await supabase
      .from('notas_prensa')
      .select('id, asunto, remitente, estado, contenido_original')
      .eq('medio_id', medioId)
      .neq('estado', 'descartada')
      .order('id', { ascending: false })
      .limit(80);

    if (!error && porAsunto?.length) {
      for (const candidata of porAsunto) {
        if (excluirNotaId && candidata.id === excluirNotaId) continue;
        if (normalizarAsunto(candidata.asunto) !== asuntoNorm) continue;
        if (contenidoEsSimilar(contenidoOriginal, candidata.contenido_original)) {
          return { nota: candidata, motivo: 'mismo_asunto_contenido' };
        }
      }
    }
  }

  const textoNorm = normalizarTexto(contenidoOriginal);

  if (textoNorm.length >= 160) {
    const fragmento = fragmentoSeguro(textoNorm, 80);
    if (fragmento.length >= 40) {
      const { data: porContenido, error } = await supabase
        .from('notas_prensa')
        .select('id, asunto, remitente, estado, contenido_original')
        .eq('medio_id', medioId)
        .neq('estado', 'descartada')
        .ilike('contenido_original', `%${fragmento}%`)
        .order('id', { ascending: false })
        .limit(5);

      if (!error && porContenido?.length) {
        for (const candidata of porContenido) {
          if (excluirNotaId && candidata.id === excluirNotaId) continue;
          if (contenidoEsSimilar(contenidoOriginal, candidata.contenido_original)) {
            return { nota: candidata, motivo: 'mismo_contenido' };
          }
        }
      }
    }
  }

  return null;
}

export async function buscarArticuloDeNota(supabase, notaId, medioId) {
  const { data, error } = await supabase
    .from('articulos')
    .select('id, estado, titulo_generado')
    .eq('nota_prensa_id', notaId)
    .eq('medio_id', medioId)
    .in('estado', ['pendiente_revision', 'publicado'])
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo comprobar artículos existentes: ${error.message}`);
  }

  return data;
}

export function describirMotivoDuplicado(motivo) {
  switch (motivo) {
    case 'misma_url':
      return 'misma URL';
    case 'mismo_asunto_contenido':
      return 'mismo asunto y contenido';
    case 'mismo_contenido':
      return 'mismo contenido';
    case 'message_id':
      return 'mismo email';
    case 'articulo_existente':
      return 'artículo ya generado';
    default:
      return motivo || 'duplicado';
  }
}
