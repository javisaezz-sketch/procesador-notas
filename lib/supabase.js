import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { resolverEmailNotificacionArticulo } from './emailNotificacion';
import { esNotaDesdeUrl } from './extraerContenidoUrl';
import { normalizeSupabaseUrl } from './normalizeSupabaseUrl.js';
import { compararColaEditorial } from './fechaEvento.js';

const ARTICULOS_LIST_FIELDS =
  'id,titulo_generado,estado,medio_id,nota_prensa_id,imagen_destacada_url,email_notificacion,wp_post_id,wp_post_url,wp_post_status,fecha_creacion,fecha_programada,fecha_evento';
const ARTICULOS_LIST_FIELDS_BASE =
  'id,titulo_generado,estado,medio_id,nota_prensa_id,imagen_destacada_url,email_notificacion,wp_post_id,wp_post_url,wp_post_status,fecha_creacion';
const LIMITE_LISTA_PANEL = 60;

function getSupabaseClientOptions() {
  if (typeof globalThis.WebSocket === 'undefined') {
    return {
      realtime: {
        transport: WebSocket,
      },
    };
  }

  return {};
}

export function createSupabaseClient() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_ANON_KEY). Comprueba variables en Vercel y redeploy.',
    );
  }

  return createClient(url, key, getSupabaseClientOptions());
}

async function enrichArticulos(articulos) {
  if (!articulos?.length) {
    return [];
  }

  const medioIds = [...new Set(articulos.map((a) => a.medio_id).filter(Boolean))];
  const notaIds = [...new Set(articulos.map((a) => a.nota_prensa_id).filter(Boolean))];

  const [{ data: medios }, { data: notas }] = await Promise.all([
    medioIds.length
      ? createSupabaseClient()
          .from('medios')
          .select('id, nombre, slug, color, categorias_json')
          .in('id', medioIds)
      : Promise.resolve({ data: [] }),
    notaIds.length
      ? createSupabaseClient()
          .from('notas_prensa')
          .select('id, asunto, remitente, fecha_recepcion, email_message_id')
          .in('id', notaIds)
      : Promise.resolve({ data: [] }),
  ]);

  const mediosMap = Object.fromEntries((medios ?? []).map((m) => [m.id, m]));
  const notasMap = Object.fromEntries((notas ?? []).map((n) => [n.id, n]));

  return articulos.map((articulo) => {
    const totalImagenes = articulo.imagen_destacada_url ? 1 : 0;
    const nota = notasMap[articulo.nota_prensa_id] ?? null;
    const sinNotificacion = esNotaDesdeUrl(nota);

    return {
      ...articulo,
      medios: mediosMap[articulo.medio_id] ?? null,
      notas_prensa: nota,
      sin_notificacion: sinNotificacion,
      email_notificacion: sinNotificacion
        ? null
        : resolverEmailNotificacionArticulo(articulo, nota),
      imagenes_adicionales: totalImagenes > 1 ? totalImagenes - 1 : 0,
    };
  });
}

function deduplicarArticulosPorNotaYMedio(articulos) {
  const vistos = new Set();
  const unicos = [];

  for (const articulo of articulos) {
    if (!articulo.nota_prensa_id || !articulo.medio_id) {
      unicos.push(articulo);
      continue;
    }

    const clave = `${articulo.nota_prensa_id}:${articulo.medio_id}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    unicos.push(articulo);
  }

  return unicos;
}

async function getArticulosPorEstado(estado) {
  const estados = Array.isArray(estado) ? estado : [estado];
  const supabase = createSupabaseClient();

  let { data: articulos, error } = await supabase
    .from('articulos')
    .select(ARTICULOS_LIST_FIELDS)
    .in('estado', estados)
    .order('fecha_creacion', { ascending: false })
    .limit(LIMITE_LISTA_PANEL);

  if (error && /fecha_programada|fecha_evento/.test(error.message || '')) {
    ({ data: articulos, error } = await supabase
      .from('articulos')
      .select(ARTICULOS_LIST_FIELDS_BASE)
      .in('estado', estados)
      .order('fecha_creacion', { ascending: false })
      .limit(LIMITE_LISTA_PANEL));
  }

  if (error) {
    throw new Error(`Error al leer artículos: ${error.message}`);
  }

  return enrichArticulos(deduplicarArticulosPorNotaYMedio(articulos ?? []));
}

function esArticuloGoogleMaps(articulo) {
  const remitente = articulo.notas_prensa?.remitente || '';
  const asunto = articulo.notas_prensa?.asunto || '';
  const messageId = articulo.notas_prensa?.email_message_id || '';
  return (
    messageId.startsWith('gmaps:') ||
    remitente.toLowerCase().includes('google maps') ||
    asunto.startsWith('Reseña Google Maps:')
  );
}

export async function getArticulosPendientes() {
  const articulos = await getArticulosPorEstado(['pendiente_revision', 'programado']);
  return articulos
    .filter((articulo) => {
      if (esArticuloGoogleMaps(articulo)) {
        return false;
      }
      return true;
    })
    .sort(compararColaEditorial);
}

export async function getArticulosAprobados() {
  const articulos = await getArticulosPorEstado('publicado');
  return articulos.filter((articulo) => {
    if (esArticuloGoogleMaps(articulo)) {
      return false;
    }
    return articulo.wp_post_status !== 'publish';
  });
}

export async function getMediosPanel() {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('medios')
    .select('id, nombre, slug, color, categorias_json')
    .order('id', { ascending: true });

  if (error) {
    throw new Error(`Error al leer medios: ${error.message}`);
  }

  return data ?? [];
}

export async function getConteoColaNotas() {
  const supabase = createSupabaseClient();
  const { count, error } = await supabase
    .from('notas_prensa')
    .select('id', { count: 'exact', head: true })
    .in('estado', ['recibida', 'procesando']);

  if (error) return 0;
  return count ?? 0;
}

export async function getNotasConError() {
  const supabase = createSupabaseClient();

  let { data: notas, error } = await supabase
    .from('notas_prensa')
    .select(
      'id, asunto, remitente, estado, error_mensaje, medio_id, fecha_recepcion',
    )
    .eq('estado', 'error_procesamiento')
    .order('fecha_recepcion', { ascending: false });

  if (error && String(error.message).includes('error_mensaje')) {
    ({ data: notas, error } = await supabase
      .from('notas_prensa')
      .select(
        'id, asunto, remitente, estado, medio_id, fecha_recepcion',
      )
      .eq('estado', 'error_procesamiento')
      .order('fecha_recepcion', { ascending: false }));
  }

  if (error) {
    throw new Error(`Error al leer notas con error: ${error.message}`);
  }

  if (!notas?.length) {
    return [];
  }

  const medioIds = [...new Set(notas.map((nota) => nota.medio_id).filter(Boolean))];
  const { data: medios } = medioIds.length
    ? await supabase
        .from('medios')
        .select('id, nombre, slug, color')
        .in('id', medioIds)
    : { data: [] };

  const mediosMap = Object.fromEntries((medios ?? []).map((medio) => [medio.id, medio]));

  return notas.map((nota) => ({
    ...nota,
    medios: mediosMap[nota.medio_id] ?? null,
  }));
}

export async function getGoogleMapsReviews() {
  try {
    const { getGoogleMapsReviewsPendientes } = await import('./googleMaps.js');
    const supabase = createSupabaseClient();
    return await getGoogleMapsReviewsPendientes(supabase, false);
  } catch (err) {
    console.error('[Supabase] Error al cargar reseñas de Google Maps:', err.message);
    return [];
  }
}
