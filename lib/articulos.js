import { createSupabaseClient } from './supabase';
import { eliminarEmailNotaDesdeArticulo } from './eliminarEmailNota.js';

export async function anularArticulo(articuloId) {
  const supabase = createSupabaseClient();

  const { data: articulo, error: readError } = await supabase
    .from('articulos')
    .select('id, titulo_generado, estado')
    .eq('id', articuloId)
    .single();

  if (readError || !articulo) {
    throw new Error('Artículo no encontrado');
  }

  if (articulo.estado !== 'pendiente_revision') {
    throw new Error('Este artículo ya no está pendiente de revisión');
  }

  const { data, error } = await supabase
    .from('articulos')
    .update({ estado: 'anulado' })
    .eq('id', articuloId)
    .eq('estado', 'pendiente_revision')
    .select('id, estado, titulo_generado')
    .single();

  if (error) {
    throw new Error(`No se pudo anular el artículo: ${error.message}`);
  }

  let emailBuzon = { eliminado: false, motivo: 'no_intentado' };

  try {
    emailBuzon = await eliminarEmailNotaDesdeArticulo(articuloId);
  } catch (deleteError) {
    emailBuzon = {
      eliminado: false,
      motivo: 'error_buzon',
      error: deleteError.message,
    };
  }

  return { ...data, emailBuzon };
}
