import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { resolverEmailNotificacionArticulo } from './emailNotificacion';
import { esNotaDesdeUrl } from './extraerContenidoUrl';

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
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Faltan SUPABASE_URL o SUPABASE_ANON_KEY. Comprueba tu archivo .env en la raíz del proyecto.',
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

  const [{ data: medios }, { data: notas }, { data: imagenesNotas }] = await Promise.all([
    medioIds.length
      ? createSupabaseClient()
          .from('medios')
          .select('id, nombre, slug, color, url_wordpress, categorias_json')
          .in('id', medioIds)
      : Promise.resolve({ data: [] }),
    notaIds.length
      ? createSupabaseClient()
          .from('notas_prensa')
          .select('id, asunto, contenido_original, contenido_html, remitente, fecha_recepcion')
          .in('id', notaIds)
      : Promise.resolve({ data: [] }),
    notaIds.length
      ? createSupabaseClient()
          .from('notas_prensa_imagenes')
          .select('nota_prensa_id')
          .in('nota_prensa_id', notaIds)
      : Promise.resolve({ data: [] }),
  ]);

  const mediosMap = Object.fromEntries((medios ?? []).map((m) => [m.id, m]));
  const notasMap = Object.fromEntries((notas ?? []).map((n) => [n.id, n]));
  const imagenesPorNota = {};

  for (const imagen of imagenesNotas ?? []) {
    imagenesPorNota[imagen.nota_prensa_id] =
      (imagenesPorNota[imagen.nota_prensa_id] ?? 0) + 1;
  }

  return articulos.map((articulo) => {
    const totalImagenes = imagenesPorNota[articulo.nota_prensa_id] ?? 0;
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

async function getArticulosPorEstado(estado) {
  const supabase = createSupabaseClient();

  const { data: articulos, error } = await supabase
    .from('articulos')
    .select('*')
    .eq('estado', estado)
    .order('fecha_creacion', { ascending: false });

  if (error) {
    throw new Error(`Error al leer artículos: ${error.message}`);
  }

  return enrichArticulos(articulos ?? []);
}

export async function getArticulosPendientes() {
  return getArticulosPorEstado('pendiente_revision');
}

export async function getArticulosAprobados() {
  const articulos = await getArticulosPorEstado('publicado');
  return articulos.filter((articulo) => articulo.wp_post_status !== 'publish');
}
