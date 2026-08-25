import { createSupabaseAdmin } from './ingestNota.js';

const ROW_ID = 1;

function tablaDisponible(error) {
  return !String(error?.message ?? '').includes('pipeline_estado');
}

export async function getPipelineEstado() {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('pipeline_estado')
    .select(
      'id, ok, ejecutado_en, emails_nuevas, articulos_generados, notas_reactivadas, advertencias, fatal',
    )
    .eq('id', ROW_ID)
    .maybeSingle();

  if (error) {
    if (!tablaDisponible(error)) return null;
    throw new Error(`No se pudo leer el estado del pipeline: ${error.message}`);
  }

  return data;
}

export async function savePipelineEstado(resumen) {
  const supabase = createSupabaseAdmin();

  const payload = {
    id: ROW_ID,
    ok: resumen.ok ?? true,
    ejecutado_en: new Date().toISOString(),
    emails_nuevas: resumen.emails?.nuevas ?? 0,
    articulos_generados: resumen.articulosGenerados ?? 0,
    notas_reactivadas: resumen.notasReactivadas ?? 0,
    advertencias: resumen.advertencias ?? [],
    fatal: resumen.fatal ?? null,
  };

  const { error } = await supabase.from('pipeline_estado').upsert(payload);

  if (error && tablaDisponible(error)) {
    throw new Error(`No se pudo guardar el estado del pipeline: ${error.message}`);
  }
}
