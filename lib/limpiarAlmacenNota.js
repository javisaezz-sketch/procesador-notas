const BUCKET = 'notas-prensa';

export function rutaDesdeUrlPublica(url) {
  if (!url) return null;

  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
  }

  const signMarker = `/object/sign/${BUCKET}/`;
  const signIdx = url.indexOf(signMarker);
  if (signIdx !== -1) {
    return decodeURIComponent(url.slice(signIdx + signMarker.length).split('?')[0]);
  }

  const altMarker = `/${BUCKET}/`;
  const altIdx = url.indexOf(altMarker);
  if (altIdx !== -1) {
    return decodeURIComponent(url.slice(altIdx + altMarker.length).split('?')[0]);
  }

  return null;
}

async function eliminarArchivosStorage(supabase, rutas) {
  const unicas = [...new Set(rutas.filter(Boolean))];
  if (!unicas.length) return 0;

  let eliminados = 0;

  for (let i = 0; i < unicas.length; i += 100) {
    const lote = unicas.slice(i, i + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(lote);

    if (error) {
      throw new Error(`Error al borrar archivos en Storage: ${error.message}`);
    }

    eliminados += lote.length;
  }

  return eliminados;
}

/**
 * Libera cuota de Supabase borrando imágenes del bucket y el HTML pesado de la nota.
 * Solo usar cuando el artículo ya está publicado/anulado o la nota fue descartada.
 */
export async function limpiarRecursosNota(
  supabase,
  notaPrensaId,
  { vaciarHtml = true } = {},
) {
  if (!notaPrensaId) {
    return { archivosEliminados: 0, registrosImagenes: 0, htmlVaciado: false };
  }

  const { data: imagenes, error: readError } = await supabase
    .from('notas_prensa_imagenes')
    .select('id, url')
    .eq('nota_prensa_id', notaPrensaId);

  if (readError) {
    throw new Error(`No se pudieron leer imágenes de la nota: ${readError.message}`);
  }

  const rutas = (imagenes ?? [])
    .map((imagen) => rutaDesdeUrlPublica(imagen.url))
    .filter(Boolean);

  const archivosEliminados = await eliminarArchivosStorage(supabase, rutas);

  let registrosImagenes = 0;

  if (imagenes?.length) {
    const { error: deleteError, count } = await supabase
      .from('notas_prensa_imagenes')
      .delete({ count: 'exact' })
      .eq('nota_prensa_id', notaPrensaId);

    if (deleteError) {
      throw new Error(`No se pudieron borrar registros de imágenes: ${deleteError.message}`);
    }

    registrosImagenes = count ?? imagenes.length;
  }

  let htmlVaciado = false;

  if (vaciarHtml) {
    const { error: htmlError } = await supabase
      .from('notas_prensa')
      .update({ contenido_html: null })
      .eq('id', notaPrensaId)
      .not('contenido_html', 'is', null);

    if (htmlError) {
      throw new Error(`No se pudo vaciar contenido_html: ${htmlError.message}`);
    }

    htmlVaciado = true;
  }

  return { archivosEliminados, registrosImagenes, htmlVaciado };
}

export async function limpiarRecursosNotaDesdeArticulo(supabase, articuloId) {
  const { data: articulo, error } = await supabase
    .from('articulos')
    .select('nota_prensa_id')
    .eq('id', articuloId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer el artículo: ${error.message}`);
  }

  if (!articulo?.nota_prensa_id) {
    return { archivosEliminados: 0, registrosImagenes: 0, htmlVaciado: false };
  }

  return limpiarRecursosNota(supabase, articulo.nota_prensa_id);
}
