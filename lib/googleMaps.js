import { GoogleGenerativeAI } from '@google/generative-ai';
import { createSupabaseAdmin, subirImagenNota } from './ingestNota.js';

const DEFAULT_PROFILE_URL =
  process.env.GOOGLE_MAPS_PROFILE_URL ||
  'https://www.google.com/maps/contrib/114975419981619629986/reviews';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const HASHTAGS_OBLIGATORIOS_LAGLAM = [
  '#LaGlamDelBuenVivir',
  '#ElArteDelBuenVivir',
  '#VozConEstilo',
  '#ModaYTendencias',
  '#GastroLover',
  '#RutasConEstilo',
  '#ChicAndCasual',
  '#LifestyleElegante',
  '#PlanesConEncanto',
  '#EstiloDeVida',
];

async function descargarFotoGoogleMaps(url) {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Referer: 'https://www.google.com/',
    },
    signal: AbortSignal.timeout(40000),
  });

  if (!res.ok) {
    throw new Error(`No se pudo descargar la foto de Google Maps (${res.status})`);
  }

  const contentType = res.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error(`La URL de Google Maps no devolvió una imagen (${contentType})`);
  }

  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType,
  };
}

/**
 * Instagram no puede leer lh3.googleusercontent.com: rehospeda las fotos en Storage.
 */
export async function rehospedarFotosGoogleMaps({
  notaId,
  urls = [],
  fotoSeleccionadaUrl = null,
}) {
  if (!notaId) {
    return {
      fotoPrincipal: fotoSeleccionadaUrl || urls[0] || null,
      fotos: urls,
    };
  }

  const supabaseAdmin = createSupabaseAdmin();
  const ordenadas = [];
  if (fotoSeleccionadaUrl) ordenadas.push(fotoSeleccionadaUrl);
  for (const url of urls) {
    if (url && !ordenadas.includes(url)) ordenadas.push(url);
  }

  const rehospedadas = [];
  for (let i = 0; i < ordenadas.length; i += 1) {
    try {
      const { buffer, contentType } = await descargarFotoGoogleMaps(ordenadas[i]);
      const publicUrl = await subirImagenNota(supabaseAdmin, notaId, {
        buffer,
        contentType,
        filename: `gmaps_${i + 1}.jpg`,
        origen: 'google_maps',
      });
      rehospedadas.push(publicUrl);
    } catch (err) {
      console.warn(`[GoogleMaps] No se pudo rehospedar foto ${i + 1}:`, err.message);
      rehospedadas.push(ordenadas[i]);
    }
  }

  return {
    fotoPrincipal: rehospedadas[0] || fotoSeleccionadaUrl || urls[0] || null,
    fotos: rehospedadas,
  };
}

/**
 * Comprueba si la tabla google_maps_reviews existe en Supabase
 */
export async function tablaReviewsExiste(supabase) {
  try {
    const { error } = await supabase.from('google_maps_reviews').select('id').limit(1);
    if (error && String(error.message || '').includes('google_maps_reviews')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Extrae las reseñas directamente desde el perfil público de Google Maps
 */
export async function extraerResenasGoogleMaps(profileUrl = DEFAULT_PROFILE_URL) {
  const urlConIdioma = profileUrl.includes('hl=')
    ? profileUrl
    : `${profileUrl}${profileUrl.includes('?') ? '&' : '?'}hl=es`;

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'es-ES,es;q=0.9',
  };

  const res = await fetch(urlConIdioma, { headers });
  if (!res.ok) {
    throw new Error(`Error al cargar el perfil de Google Maps: HTTP ${res.status}`);
  }

  const html = await res.text();
  const match = html.match(/<link[^>]+href=["'](\/locationhistory\/preview\/mas[^"']+)["']/i);
  if (!match) {
    throw new Error(
      'No se encontró el enlace de datos en el perfil de Google Maps. Comprueba la URL del perfil.',
    );
  }

  const rawApiUrl = 'https://www.google.com' + match[1].replace(/&amp;/g, '&');
  const parsedUrl = new URL(rawApiUrl);
  const pb = parsedUrl.searchParams.get('pb');
  if (pb) {
    // Ampliar el límite en el protobuf a 200 (máximo soportado por Google Maps) para extraer todo el historial completo
    const expandedPb = pb
      .replace(/!4m1!3i\d+!/g, '!4m1!3i200!')
      .replace(/!1i\d+!/g, '!1i200!');
    parsedUrl.searchParams.set('pb', expandedPb);
  }
  const apiUrl = parsedUrl.toString();

  const apiRes = await fetch(apiUrl, { headers });
  if (!apiRes.ok) {
    throw new Error(`Error al consultar la API de datos de Google Maps: HTTP ${apiRes.status}`);
  }

  const apiText = await apiRes.text();
  const clean = apiText.replace(/^\)\]\}'/, '').trim();
  const data = JSON.parse(clean);
  const rawList = data[45]?.[0] || [];

  return rawList
    .map((item, index) => {
      // 1. Datos del establecimiento
      const placeName = item[1]?.[0]?.[4] || item[4]?.[2] || 'Lugar desconocido';
      const address = item[1]?.[0]?.[5] || item[4]?.[3] || '';
      const city = item[1]?.[0]?.[14] || item[4]?.[26] || '';
      const placeId = item[1]?.[0]?.[1] || item[4]?.[18] || `review-${index}`;
      const lat = item[1]?.[0]?.[3]?.[2] ?? null;
      const lng = item[1]?.[0]?.[3]?.[3] ?? null;
      const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;

      // 2. Datos de la reseña
      const stars = Number(item[2]?.[2]?.[0]?.[0] ?? item[2]?.[1]?.[13]?.[4] ?? 5);
      const relativeDate = item[2]?.[1]?.[6] || '';
      const timestampMicros = item[2]?.[1]?.[2] || null;
      const fecha = timestampMicros
        ? new Date(Math.floor(Number(timestampMicros) / 1000)).toISOString()
        : new Date().toISOString();
      const texto = item[2]?.[2]?.[15]?.[0]?.[0] || '';

      // 3. Fotografías del autor en alta resolución
      const rawPhotos = item[2]?.[2]?.[2] || [];
      const fotos = rawPhotos
        .map((p) => {
          const urlRaw = p[1]?.[6]?.[0] || '';
          if (!urlRaw) return null;
          const baseUrl = urlRaw.split('=')[0];
          return baseUrl ? `${baseUrl}=s1600` : null;
        })
        .filter(Boolean);

      // Fallback si no hay fotos del usuario pero hay portada del lugar
      if (fotos.length === 0 && item[1]?.[0]?.[6]?.[0]?.[2]?.[1]) {
        const coverRaw = item[1][0][6][0][2][1];
        const baseCover = coverRaw.split('=')[0];
        if (baseCover) fotos.push(`${baseCover}=s1600`);
      }

      const reviewHex = item[2]?.[1]?.[0]?.replace(/^0x0:/, '') || '';
      const reviewId = reviewHex
        ? `${placeId}_${reviewHex}`
        : `${placeId}_${Math.floor(Number(timestampMicros || index) / 1000)}`;

      return {
        review_id: reviewId,
        place_id: placeId,
        place_name: placeName,
        address,
        city,
        lat,
        lng,
        maps_url: mapsUrl,
        stars,
        relative_date: relativeDate,
        fecha_resena: fecha,
        texto_original: texto,
        fotos,
        estado: 'pendiente',
      };
    })
    // El usuario solo quiere ver y generar posts de reseñas de 5 estrellas
    .filter((r) => r.stars === 5);
}

/**
 * Obtiene las reseñas pendientes de Google Maps, sincronizando con Supabase
 */
export async function getGoogleMapsReviewsPendientes(supabase, forzarSync = false) {
  const tieneTabla = await tablaReviewsExiste(supabase);

  // 1. Obtener identificadores ya procesados o descartados desde notas_prensa (fallback permanente)
  const { data: notasExistentes } = await supabase
    .from('notas_prensa')
    .select('email_message_id, estado')
    .like('email_message_id', 'gmaps:%');

  const mapaNotas = new Map();
  if (notasExistentes) {
    for (const n of notasExistentes) {
      const rId = n.email_message_id.replace(/^gmaps:/, '');
      mapaNotas.set(rId, n.estado);
    }
  }

  // 2. Si la tabla google_maps_reviews existe
  if (tieneTabla) {
    // Si no se fuerza sincronización, leemos primero de la tabla si ya tiene el archivo histórico
    if (!forzarSync) {
      const { data: reviewsDb, error } = await supabase
        .from('google_maps_reviews')
        .select('*')
        .eq('estado', 'pendiente')
        .eq('stars', 5)
        .order('fecha_resena', { ascending: false });

      if (!error && reviewsDb && reviewsDb.length >= 20) {
        return reviewsDb;
      }
    }

    // Si está incompleta o se fuerza sincronización, extraemos todo el historial desde Maps
    let reviewsScraped = [];
    try {
      reviewsScraped = await extraerResenasGoogleMaps();
    } catch (scrapeErr) {
      console.error('[GoogleMaps] Error al extraer reseñas:', scrapeErr.message);
      // Fallback a lo que haya en DB si falla el scraping
      const { data: reviewsDb } = await supabase
        .from('google_maps_reviews')
        .select('*')
        .eq('estado', 'pendiente')
        .eq('stars', 5)
        .order('fecha_resena', { ascending: false });
      return reviewsDb || [];
    }

    // Leemos el estado actual de todas las reseñas en DB
    const { data: enDb } = await supabase
      .from('google_maps_reviews')
      .select('review_id, estado');
    const estadosDb = new Map((enDb || []).map((r) => [r.review_id, r.estado]));

    // Insertar nuevas reseñas o actualizar respetando estados archivados
    const inserts = [];
    for (const r of reviewsScraped) {
      const estadoActual = estadosDb.get(r.review_id) || mapaNotas.get(r.review_id);
      if (
        estadoActual === 'publicado' ||
        estadoActual === 'descartado' ||
        estadoActual === 'descartada'
      ) {
        // Ya está archivada/publicada/descartada
        continue;
      }

      inserts.push({
        review_id: r.review_id,
        place_id: r.place_id,
        place_name: r.place_name,
        address: r.address,
        city: r.city,
        lat: r.lat,
        lng: r.lng,
        maps_url: r.maps_url,
        stars: r.stars,
        relative_date: r.relative_date,
        fecha_resena: r.fecha_resena,
        texto_original: r.texto_original,
        fotos: r.fotos,
        estado: 'pendiente',
        updated_at: new Date().toISOString(),
      });
    }

    if (inserts.length > 0) {
      await supabase.from('google_maps_reviews').upsert(inserts, {
        onConflict: 'review_id',
        ignoreDuplicates: false,
      });
    }

    // Devolvemos solo las reseñas de 5 estrellas pendientes desde la base de datos
    const { data: reviewsFinales } = await supabase
      .from('google_maps_reviews')
      .select('*')
      .eq('estado', 'pendiente')
      .eq('stars', 5)
      .order('fecha_resena', { ascending: false });

    return reviewsFinales || [];
  }

  // 3. Fallback en memoria si la tabla aún no se ha creado con SQL
  const reviewsScraped = await extraerResenasGoogleMaps();
  return reviewsScraped
    .filter((r) => r.stars === 5)
    .filter((r) => {
      const estado = mapaNotas.get(r.review_id);
      return !estado || (estado !== 'descartada' && estado !== 'procesada');
    });
}

/**
 * Descarta una reseña de Google Maps para que no vuelva a aparecer
 */
export async function descartarReviewGoogleMaps(supabase, reviewId) {
  const tieneTabla = await tablaReviewsExiste(supabase);

  if (tieneTabla) {
    await supabase
      .from('google_maps_reviews')
      .update({ estado: 'descartado', updated_at: new Date().toISOString() })
      .eq('review_id', reviewId);
  }

  // Doble capa en notas_prensa
  await supabase.from('notas_prensa').upsert(
    {
      remitente: 'google_maps',
      asunto: `Reseña Google Maps descartada (${reviewId})`,
      estado: 'descartada',
      email_message_id: `gmaps:${reviewId}`,
      medio_id: 5,
      fecha_recepcion: new Date().toISOString(),
    },
    { onConflict: 'email_message_id' },
  );

  return { ok: true };
}

/**
 * Genera con Gemini el post de Instagram para LaGlam a partir de una reseña de Google Maps
 * e inserta el artículo en Supabase listo para revisión o publicación
 */
export async function generarPostInstagramDesdeReview({
  supabase,
  review,
  fotoSeleccionadaUrl = null,
  fotosSeleccionadas = null,
  instruccionesEditor = '',
}) {
  if (!review) {
    throw new Error('Faltan los datos de la reseña');
  }

  // 1. Obtener medio LaGlam
  const { data: medioLaGlam, error: medioErr } = await supabase
    .from('medios')
    .select('*')
    .eq('slug', 'laglam')
    .maybeSingle();

  if (medioErr || !medioLaGlam) {
    throw new Error('No se encontró el medio LaGlam en la base de datos');
  }

  const fotosElegidas = (
    Array.isArray(fotosSeleccionadas) && fotosSeleccionadas.length > 0
      ? fotosSeleccionadas
      : review.fotos || []
  ).filter(Boolean).slice(0, 10);

  const fotoPrincipal =
    fotoSeleccionadaUrl ||
    fotosElegidas[0] ||
    (review.fotos && review.fotos.length > 0 ? review.fotos[0] : null);

  // 2. Descargar imagen para visión multimodal si existe
  let imagePart = null;
  if (fotoPrincipal) {
    try {
      const imgRes = await fetch(fotoPrincipal);
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        if (buf.byteLength < 10 * 1024 * 1024) {
          imagePart = {
            inlineData: {
              data: Buffer.from(buf).toString('base64'),
              mimeType: imgRes.headers.get('content-type') || 'image/jpeg',
            },
          };
        }
      }
    } catch (err) {
      console.warn('[GoogleMaps] No se pudo descargar imagen para visión IA:', err.message);
    }
  }

  // 3. Configurar Gemini
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: medioLaGlam.prompt_personalidad,
  });

  const prompt = `
Actúa como la comunicadora, estilista y periodista de radio detrás de @laglamdelbuenvivir, la cuenta de referencia en estilo de vida, gastronomía chic, escapadas y el arte del buen vivir.

Convierte esta reseña gastronómica personal de Google Maps ${imagePart ? 'y la fotografía del plato/local adjunta ' : ''}en un post vibrante, apetecible e irresistible para el feed de Instagram.

DATOS DEL LUGAR Y LA RESEÑA:
- Establecimiento: ${review.place_name}
- Localidad / Municipio: ${review.city || 'No especificada'}
- Dirección: ${review.address || 'No especificada'}
- Valoración: ${review.stars}/5 estrellas
- Reseña original del comensal:
${review.texto_original || '(Sin texto escrito por el comensal, crea el post en base al establecimiento y la fotografía)'}

${instruccionesEditor ? `INSTRUCCIONES ADICIONALES DEL EDITOR (MÁXIMA PRIORIDAD):\n${instruccionesEditor}\n` : ''}

DIRECTRICES DEL POST DE INSTAGRAM:
1. TONO: Cercano, cómplice, fresco, gourmet y con chispa ("apunta esta joya", "menudo descubrimiento", "atentas amantes del buen comer"). Cero lenguaje corporativo.
2. INTEGRACIÓN VISUAL: ${imagePart ? 'Observa la fotografía adjunta con atención a los detalles (presentación del plato, textura, jugosidad de la carne, pan, salsa, ambiente o iluminación) y menciónalos de forma natural en el texto para que la foto y el pie de foto sean inseparables.' : 'Haz el texto muy evocador y sensorial.'}
3. ESTRUCTURA:
   - Gancho inicial magnético en la primera línea para parar el scroll en Instagram.
   - Párrafos cortos y limpios (máximo 2-3 líneas en etiquetas <p>), describiendo la experiencia culinaria, el producto local y el ambiente.
   - Cierre con pregunta o llamada a la acción cómplice (ej: invitar a comentar con quién irían, guardar la recomendación en favoritos, etc.).
   - Termina SIEMPRE con el bloque de los 10 hashtags oficiales obligatorios:
#LaGlamDelBuenVivir #ElArteDelBuenVivir #VozConEstilo #ModaYTendencias #GastroLover #RutasConEstilo #ChicAndCasual #LifestyleElegante #PlanesConEncanto #EstiloDeVida

Responde ÚNICAMENTE con JSON válido en este formato exacto:
{
  "titulo_generado": "Titular sonoro corto (máximo 8-10 palabras)",
  "contenido_generado": "<p>Hook inicial...</p><p>Detalle gastronómico...</p><p>¿Te animas a probarlo?</p><p>#LaGlamDelBuenVivir #ElArteDelBuenVivir #VozConEstilo #ModaYTendencias #GastroLover #RutasConEstilo #ChicAndCasual #LifestyleElegante #PlanesConEncanto #EstiloDeVida</p>"
}
`.trim();

  const parts = imagePart ? [prompt, imagePart] : [prompt];
  const geminiRes = await model.generateContent(parts);
  const rawText = geminiRes.response.text();

  const jsonMatch = rawText.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Respuesta Gemini inválida al generar post de Instagram');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  let { titulo_generado, contenido_generado } = parsed;

  if (!titulo_generado || !contenido_generado) {
    throw new Error('Faltan titulo_generado o contenido_generado en la respuesta de la IA');
  }

  // Asegurar los 10 hashtags obligatorios de LaGlam al final
  const faltanHashtags = HASHTAGS_OBLIGATORIOS_LAGLAM.filter(
    (tag) => !contenido_generado.includes(tag),
  );
  if (faltanHashtags.length > 0) {
    contenido_generado = `${contenido_generado.replace(/<\/article>$/i, '')}<p>${HASHTAGS_OBLIGATORIOS_LAGLAM.join(' ')}</p>`;
  }

  // 4. Crear registro en notas_prensa
  const { data: notaGuardada, error: notaErr } = await supabase
    .from('notas_prensa')
    .insert({
      remitente: 'Google Maps Local Guide',
      asunto: `Reseña Google Maps: ${review.place_name} (${review.city || ''})`,
      contenido_original: `Establecimiento: ${review.place_name}\nDirección: ${review.address}\nMunicipio: ${review.city}\nEstrellas: ${review.stars}/5\nURL Maps: ${review.maps_url}\n\nReseña original:\n${review.texto_original || '(Sin texto)'}`,
      contenido_html: `<article><p><strong>${review.place_name}</strong> - ${review.city}</p><p>Valoración: ${review.stars}/5 estrellas</p><p>${review.texto_original || ''}</p></article>`,
      estado: 'procesada',
      email_message_id: `gmaps:${review.review_id}`,
      medio_id: medioLaGlam.id,
      fecha_recepcion: review.fecha_resena || new Date().toISOString(),
    })
    .select('id')
    .single();

  if (notaErr) {
    console.warn('[GoogleMaps] Error al guardar nota_prensa:', notaErr.message);
  }

  const notaId = notaGuardada?.id || null;

  const fotosRehospedadas = await rehospedarFotosGoogleMaps({
    notaId,
    urls: fotosElegidas,
    fotoSeleccionadaUrl: fotoPrincipal,
  });

  // 5. Crear el artículo en articulos
  const { data: articuloCreado, error: artErr } = await supabase
    .from('articulos')
    .insert({
      nota_prensa_id: notaId,
      medio_id: medioLaGlam.id,
      titulo_generado: titulo_generado.trim(),
      contenido_generado: contenido_generado.trim(),
      imagen_destacada_url: fotosRehospedadas.fotoPrincipal,
      imagenes_publicar_urls: fotosRehospedadas.fotos,
      estado: 'pendiente_revision',
      wp_post_status: 'draft',
      fecha_creacion: new Date().toISOString(),
    })
    .select('id, titulo_generado, estado, medio_id, imagen_destacada_url, imagenes_publicar_urls, fecha_creacion')
    .single();

  if (artErr) {
    throw new Error(`Error al guardar el artículo generado: ${artErr.message}`);
  }

  // 6. Actualizar el estado de la reseña en google_maps_reviews
  const tieneTabla = await tablaReviewsExiste(supabase);
  if (tieneTabla) {
    await supabase
      .from('google_maps_reviews')
      .update({
        estado: 'publicado',
        articulo_id: articuloCreado.id,
        updated_at: new Date().toISOString(),
      })
      .eq('review_id', review.review_id);
  }

  return {
    ok: true,
    articulo: articuloCreado,
    notaId,
  };
}
