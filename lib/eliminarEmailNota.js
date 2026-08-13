import { createSupabaseAdmin } from './ingestNota.js';

const CAMPOS_MEDIO_POP =
  'id, nombre, email_pop_user, email_pop_password, email_pop_host, email_pop_port, email_pop_secure';

export async function eliminarEmailNotaDesdeArticulo(articuloId) {
  const supabase = createSupabaseAdmin();

  const { data: articulo, error: articuloError } = await supabase
    .from('articulos')
    .select('id, nota_prensa_id, medio_id')
    .eq('id', articuloId)
    .maybeSingle();

  if (articuloError) {
    throw new Error(`No se pudo leer el artículo: ${articuloError.message}`);
  }

  if (!articulo?.nota_prensa_id) {
    return { eliminado: false, motivo: 'sin_nota_asociada' };
  }

  const [{ data: nota, error: notaError }, { data: medio, error: medioError }] =
    await Promise.all([
      supabase
        .from('notas_prensa')
        .select('email_message_id')
        .eq('id', articulo.nota_prensa_id)
        .maybeSingle(),
      supabase
        .from('medios')
        .select(CAMPOS_MEDIO_POP)
        .eq('id', articulo.medio_id)
        .maybeSingle(),
    ]);

  if (notaError) {
    throw new Error(`No se pudo leer la nota: ${notaError.message}`);
  }

  if (medioError) {
    throw new Error(`No se pudo leer el medio: ${medioError.message}`);
  }

  const { eliminarEmailPorMessageId } = await import('./eliminarEmailPop3.cjs');

  return eliminarEmailPorMessageId(medio, nota?.email_message_id);
}
