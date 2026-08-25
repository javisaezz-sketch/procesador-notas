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

export async function reenviarNotaAMedio(notaId, targetMedioId) {
  const supabase = createSupabaseClient();
  const id = Number(notaId);
  const medioId = Number(targetMedioId);

  if (!id || !medioId) {
    throw new Error('Nota o medio inválidos');
  }

  const { data: nota, error: notaError } = await supabase
    .from('notas_prensa')
    .select('id, estado, asunto, contenido_original, medio_id')
    .eq('id', id)
    .single();

  if (notaError || !nota) {
    throw new Error('Nota no encontrada');
  }

  if (!nota.contenido_original?.trim()) {
    throw new Error(
      'La nota ya no tiene el texto original. No se puede reprocesar para otro medio.',
    );
  }

  const { data: medio, error: medioError } = await supabase
    .from('medios')
    .select('id, nombre, slug, prompt_personalidad')
    .eq('id', medioId)
    .single();

  if (medioError || !medio) {
    throw new Error('Medio no encontrado');
  }

  if (!medio.prompt_personalidad?.trim()) {
    throw new Error(
      `El medio "${medio.nombre}" no tiene prompt de personalidad configurado`,
    );
  }

  const { data: duplicado, error: duplicadoError } = await supabase
    .from('articulos')
    .select('id, estado')
    .eq('nota_prensa_id', id)
    .eq('medio_id', medioId)
    .in('estado', ['pendiente_revision', 'publicado'])
    .maybeSingle();

  if (duplicadoError) {
    throw new Error(`No se pudo comprobar artículos existentes: ${duplicadoError.message}`);
  }

  if (duplicado) {
    const estadoLabel =
      duplicado.estado === 'publicado' ? 'aprobado' : 'pendiente de revisión';
    throw new Error(
      `Ya hay un artículo ${estadoLabel} de esta nota en ${medio.nombre}`,
    );
  }

  const payload = {
    estado: 'recibida',
    medio_id: medioId,
    error_mensaje: null,
  };

  let { data: actualizada, error: updateError } = await supabase
    .from('notas_prensa')
    .update(payload)
    .eq('id', id)
    .select('id, asunto, estado, medio_id')
    .single();

  if (updateError && !columnaErrorMensajeDisponible(updateError)) {
    ({ data: actualizada, error: updateError } = await supabase
      .from('notas_prensa')
      .update({ estado: 'recibida', medio_id: medioId })
      .eq('id', id)
      .select('id, asunto, estado, medio_id')
      .single());
  }

  if (updateError) {
    throw new Error(`No se pudo encolar la nota: ${updateError.message}`);
  }

  return { nota: actualizada, medio };
}

export async function reenviarArticuloAMedio(articuloId, targetMedioId) {
  const supabase = createSupabaseClient();
  const id = Number(articuloId);
  const medioId = Number(targetMedioId);

  if (!id || !medioId) {
    throw new Error('Artículo o medio inválidos');
  }

  const { data: articulo, error } = await supabase
    .from('articulos')
    .select('id, nota_prensa_id, medio_id, titulo_generado')
    .eq('id', id)
    .single();

  if (error || !articulo) {
    throw new Error('Artículo no encontrado');
  }

  if (!articulo.nota_prensa_id) {
    throw new Error('Este artículo no está vinculado a una nota de prensa');
  }

  if (Number(articulo.medio_id) === medioId) {
    throw new Error('Elige un medio distinto al actual');
  }

  const resultado = await reenviarNotaAMedio(articulo.nota_prensa_id, medioId);

  return {
    ...resultado,
    articuloOrigenId: articulo.id,
    tituloOrigen: articulo.titulo_generado,
  };
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
