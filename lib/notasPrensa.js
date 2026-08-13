import { createSupabaseClient } from './supabase';

function columnaErrorMensajeDisponible(error) {
  return !String(error?.message ?? '').includes('error_mensaje');
}

export async function reintentarNota(notaId) {
  const supabase = createSupabaseClient();

  const { data: nota, error: readError } = await supabase
    .from('notas_prensa')
    .select('id, estado, asunto')
    .eq('id', notaId)
    .single();

  if (readError || !nota) {
    throw new Error('Nota no encontrada');
  }

  if (nota.estado !== 'error_procesamiento') {
    throw new Error('Esta nota no está en error de procesamiento');
  }

  const payload = {
    estado: 'recibida',
    error_mensaje: null,
  };

  let { data, error } = await supabase
    .from('notas_prensa')
    .update(payload)
    .eq('id', notaId)
    .eq('estado', 'error_procesamiento')
    .select('id, asunto, estado, error_mensaje')
    .single();

  if (error && !columnaErrorMensajeDisponible(error)) {
    ({ data, error } = await supabase
      .from('notas_prensa')
      .update({ estado: 'recibida' })
      .eq('id', notaId)
      .eq('estado', 'error_procesamiento')
      .select('id, asunto, estado')
      .single());
  }

  if (error) {
    throw new Error(`No se pudo reintentar la nota: ${error.message}`);
  }

  return data;
}

export async function descartarNota(notaId) {
  const supabase = createSupabaseClient();

  const { data: nota, error: readError } = await supabase
    .from('notas_prensa')
    .select('id, estado, asunto')
    .eq('id', notaId)
    .single();

  if (readError || !nota) {
    throw new Error('Nota no encontrada');
  }

  if (nota.estado !== 'error_procesamiento') {
    throw new Error('Esta nota no está en error de procesamiento');
  }

  const { data, error } = await supabase
    .from('notas_prensa')
    .update({ estado: 'descartada' })
    .eq('id', notaId)
    .eq('estado', 'error_procesamiento')
    .select('id, asunto, estado')
    .single();

  if (error) {
    throw new Error(`No se pudo descartar la nota: ${error.message}`);
  }

  return data;
}
