import { createSupabaseClient } from './supabase';
import { publicarArticulo, publicarPostEnWordPress } from './publicarArticulo';

export async function programarArticulo(
  articuloId,
  { cuando, categoriaSlug = null, publicarEnWeb = true, notificar = null, emailNotificacion = null } = {},
) {
  const fecha = new Date(cuando);
  if (Number.isNaN(fecha.getTime())) {
    throw new Error('La fecha de programación no es válida');
  }
  if (fecha.getTime() < Date.now() + 60 * 1000) {
    throw new Error('Elige una hora al menos un minuto en el futuro');
  }

  const supabase = createSupabaseClient();
  const cambios = {
    estado: 'programado',
    fecha_programada: fecha.toISOString(),
    categoria_slug: categoriaSlug,
  };
  if (notificar === true) {
    const email = String(emailNotificacion || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Marca un email válido o desactiva el aviso a la agencia');
    }
    cambios.email_notificacion = email;
  } else if (notificar === false) {
    cambios.email_notificacion = null;
  }

  const { data, error } = await supabase
    .from('articulos')
    .update(cambios)
    .eq('id', articuloId)
    .eq('estado', 'pendiente_revision')
    .select('id, titulo_generado, estado, fecha_programada, categoria_slug')
    .single();

  if (error) {
    if (/fecha_programada|categoria_slug|programado/.test(error.message || '')) {
      throw new Error(
        'Falta activar la programación en Supabase. Ejecuta el archivo supabase-programacion.sql en el SQL Editor.',
      );
    }
    throw new Error(`No se pudo programar: ${error.message}`);
  }
  if (!data) {
    throw new Error('El artículo ya no está pendiente de revisión');
  }

  return { articulo: data, publicarEnWeb };
}

export async function cancelarProgramacion(articuloId) {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from('articulos')
    .update({
      estado: 'pendiente_revision',
      fecha_programada: null,
      categoria_slug: null,
    })
    .eq('id', articuloId)
    .eq('estado', 'programado')
    .select('id, titulo_generado, estado')
    .single();

  if (error) {
    throw new Error(`No se pudo cancelar la programación: ${error.message}`);
  }
  if (!data) {
    throw new Error('Este artículo no estaba programado');
  }

  return data;
}

export async function publicarProgramados() {
  const supabase = createSupabaseClient();
  const { data: pendientes, error } = await supabase
    .from('articulos')
    .select('id, medio_id, categoria_slug, titulo_generado')
    .eq('estado', 'programado')
    .lte('fecha_programada', new Date().toISOString())
    .order('fecha_programada', { ascending: true })
    .limit(5);

  if (error) {
    throw new Error(error.message);
  }

  const publicados = [];
  const errores = [];

  for (const item of pendientes || []) {
    try {
      const { data: medio } = await supabase
        .from('medios')
        .select('slug, nombre')
        .eq('id', item.medio_id)
        .maybeSingle();

      let avisoEtiquetas = null;
      if (medio?.slug === 'laglam') {
        const slug = String(item.categoria_slug || '');
        const etiquetasInstagram = slug.startsWith('feed:') ? slug.slice(5) : '';
        const resultado = await publicarArticulo(item.id, 'feed', { etiquetasInstagram });
        avisoEtiquetas = resultado.avisoEtiquetas || null;
      } else {
        await publicarArticulo(item.id, item.categoria_slug);
        await publicarPostEnWordPress(item.id);
      }

      publicados.push({ id: item.id, titulo: item.titulo_generado, avisoEtiquetas });
    } catch (err) {
      errores.push({ id: item.id, error: err.message });
      console.error(`[programados] Artículo #${item.id}: ${err.message}`);
    }
  }

  return { publicados, errores };
}
