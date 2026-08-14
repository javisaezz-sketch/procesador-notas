require('dotenv').config();

const { createSupabaseNodeClient } = require('./supabaseNode.cjs');
const {
  REGLAS_TITULO_INLINE,
  sanitizarTituloGenerado,
} = require('./reglasTitulo.cjs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const ROJO = '\x1b[31m';
const RESET = '\x1b[0m';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const MAX_NOTAS_POR_RUN = Number(process.env.MAX_NOTAS_POR_RUN ?? 5);
const MAX_REACTIVAR_ERRORES = Number(process.env.MAX_REACTIVAR_ERRORES ?? 5);

const CAMPOS_METADATOS = new Set([
  'id', 'created_at', 'updated_at', 'fecha', 'fecha_creacion', 'fecha_entrada', 'estado',
]);

function esCampoTexto(key, value) {
  if (CAMPOS_METADATOS.has(key) || key.endsWith('_id')) return false;
  return typeof value === 'string' && value.trim().length > 0;
}

function getNotaTitulo(nota) {
  if (nota.asunto?.trim()) return nota.asunto.trim();
  if (nota.contenido_original?.trim()) {
    const linea = nota.contenido_original.trim().split('\n')[0].trim();
    return linea.length <= 120 ? linea : `${linea.slice(0, 117)}...`;
  }
  return 'Sin título';
}

function getNotaTexto(nota) {
  if (nota.contenido_original?.trim()) return nota.contenido_original.trim();
  for (const campo of ['contenido', 'texto', 'cuerpo', 'mensaje', 'body']) {
    if (nota[campo]?.trim()) return nota[campo].trim();
  }
  return '';
}

function parseGeminiResponse(text) {
  const jsonMatch = text.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Respuesta Gemini inválida');
  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.titulo_generado || !parsed.contenido_generado) {
    throw new Error('Faltan titulo_generado o contenido_generado');
  }
  return {
    titulo_generado: sanitizarTituloGenerado(String(parsed.titulo_generado).trim()),
    contenido_generado: limpiarContenidoHtml(
      sanitizarTituloGenerado(String(parsed.titulo_generado).trim()),
      String(parsed.contenido_generado).trim(),
    ),
  };
}

function normalizarTexto(texto) {
  return texto.replace(/\s+/g, ' ').trim().toUpperCase();
}

function limpiarContenidoHtml(titulo, html) {
  let contenido = html;

  // Quitar todos los H1 del cuerpo (WordPress ya usa titulo_generado como título)
  contenido = contenido.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');

  // Quitar titular repetido como texto plano al inicio
  const tituloNorm = normalizarTexto(titulo);
  const textoPlano = contenido.replace(/<[^>]+>/g, ' ').trim();
  if (normalizarTexto(textoPlano.slice(0, titulo.length + 20)).startsWith(tituloNorm)) {
    contenido = contenido.replace(
      new RegExp(`^\\s*(<p>)?\\s*${escapeRegex(titulo)}\\s*(</p>)?`, 'i'),
      '',
    );
  }

  // Eliminar párrafos vacíos al inicio
  contenido = contenido.replace(/^(\s*<p>\s*<\/p>\s*)+/i, '');

  // Asegurar wrapper article
  if (!/<article/i.test(contenido)) {
    contenido = `<article>${contenido}</article>`;
  }

  return contenido.trim();
}

function escapeRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function esErrorCuotaGemini(error) {
  const msg = String(error?.message ?? error).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('quota') ||
    msg.includes('rate limit')
  );
}

function extraerRetryDelayMs(error) {
  const msg = String(error?.message ?? error);
  const match = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (match) {
    return Math.ceil(Number(match[1]) * 1000) + 1000;
  }
  return 35000;
}

// FUNCIÓN CORREGIDA: Elimina galeria-nota al final e inserta de forma contextual
function inyectarImagenesContextuales(html, imagenesUrls, titulo) {
  let contenido = html;

  // 1. Eliminar por completo la sección galeria-nota y cualquier bloque de imágenes al final
  contenido = contenido.replace(/<section class="galeria-nota"[\s\S]*?<\/section>/gi, '');
  contenido = contenido.replace(/<div class="galeria-adjunta"[\s\S]*?<\/div>/gi, '');
  contenido = contenido.replace(/<section class="imagenes-adicionales"[\s\S]*?<\/section>/gi, '');

  // 2. Insertar de forma contextual ÚNICAMENTE las imágenes del array de seleccionadas
  if (imagenesUrls && imagenesUrls.length > 0) {
    imagenesUrls.forEach((url, index) => {
      const marcador = `[IMAGEN_${index + 1}]`;
      const tagImagen = `<figure class="wp-block-image size-large"><img src="${url}" alt="${titulo}" class="wp-image-auto"/></figure>`;

      if (contenido.includes(marcador)) {
        contenido = contenido.replace(marcador, tagImagen);
      } else {
        // Si no hay marcador explícito, la inserta tras un párrafo </p> en el cuerpo
        const partes = contenido.split('</p>');
        const numPartes = partes.length;
        if (numPartes > 2) {
          const pos = Math.min(index * 2 + 2, numPartes - 1);
          partes[pos] = partes[pos] + `\n${tagImagen}`;
          contenido = partes.join('</p>');
        } else {
          contenido += `\n${tagImagen}`;
        }
      }
    });
  }

  // 3. Limpiar cualquier marcador [IMAGEN_X] sobrante que haya generado la IA
  contenido = contenido.replace(/\[IMAGEN_\d+\]/gi, '');

  return contenido;
}

async function procesarUnaNotaConReintentos(supabase, genAI, nota) {
  const maxIntentos = 3;

  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    try {
      return await procesarUnaNota(supabase, genAI, nota);
    } catch (error) {
      const esCuota = esErrorCuotaGemini(error);
      const esUltimoIntento = intento === maxIntentos;

      if (!esCuota || esUltimoIntento) {
        throw error;
      }

      const delay = extraerRetryDelayMs(error);
      console.log(
        `   ⏳ Cuota Gemini en nota #${nota.id}, reintento ${intento}/${maxIntentos - 1} en ${Math.round(delay / 1000)}s...`,
      );
      await sleep(delay);
    }
  }

  throw new Error(`No se pudo procesar la nota #${nota.id}`);
}

async function obtenerMedioParaNota(supabase, nota) {
  if (nota.medio_id) {
    const { data: medio, error } = await supabase
      .from('medios')
      .select('*')
      .eq('id', nota.medio_id)
      .single();

    if (error) {
      throw new Error(`Medio ${nota.medio_id} no encontrado: ${error.message}`);
    }

    if (!medio?.prompt_personalidad) {
      throw new Error(`El medio "${medio?.nombre || nota.medio_id}" no tiene prompt_personalidad`);
    }

    return medio;
  }

  const { data: medios, error } = await supabase
    .from('medios')
    .select('*')
    .order('id', { ascending: true })
    .limit(1);

  if (error || !medios?.length || !medios[0].prompt_personalidad) {
    throw new Error('No hay medios configurados con prompt_personalidad');
  }

  return medios[0];
}

async function procesarUnaNota(supabase, genAI, nota) {
  const medio = await obtenerMedioParaNota(supabase, nota);
  const notaTexto = getNotaTexto(nota);
  if (!notaTexto.trim()) {
    throw new Error(`Nota ${nota.id} sin contenido utilizable`);
  }

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: medio.prompt_personalidad,
  });

  const prompt = `
Convierte la siguiente nota de prensa en un artículo periodístico completo.

REGLAS DE SALIDA JSON (OBLIGATORIO):
- "titulo_generado": UN SOLO titular (se publicará como título en WordPress).
${REGLAS_TITULO_INLINE}
- "contenido_generado": HTML dentro de <article>, SIN ningún <h1>.
- PROHIBIDO repetir el titular dentro del contenido.
- El cuerpo comienza directamente con el lead en <p>.
- El subtítulo estratégico va en <h2> (solo uno, tras el primer o segundo párrafo).
- MARCADORES DE IMAGEN: Si el artículo es largo o tiene pausas narrativas de interés, inserta en una nueva línea entre párrafos los marcadores [IMAGEN_1], [IMAGEN_2] según consideres oportuno para colocar fotos de apoyo.

Nota de prensa:
Remitente: ${nota.remitente ?? 'No indicado'}
Asunto: ${getNotaTitulo(nota)}
Contenido:
${notaTexto}

Responde ÚNICAMENTE con JSON válido:
{"titulo_generado":"...","contenido_generado":"<article><p>Lead...</p><h2>Subtítulo</h2><p>Párrafo...</p>[IMAGEN_1]<p>Párrafo...</p></article>"}
`.trim();

  const result = await model.generateContent(prompt);
  const { titulo_generado, contenido_generado } = parseGeminiResponse(
    result.response.text(),
  );

  const { resolverImagenesParaArticulo } = await import('./imagenes.js');
  const {
    quitarImagenIncrustada,
    quitarImagenesGaleria,
  } = await import('./contenidoHtml.js');

  const imagenes = await resolverImagenesParaArticulo(supabase, {
    notaPrensaId: nota.id,
    medioId: medio.id,
    contenidoHtml: nota.contenido_html,
  });

  let contenidoFinal = quitarImagenesGaleria(
    quitarImagenIncrustada(contenido_generado),
  );

  // Inyección contextual limpia sin la galeria-nota al final
  if (imagenes.adicionalesUrls.length) {
    contenidoFinal = inyectarImagenesContextuales(
      contenidoFinal,
      imagenes.adicionalesUrls,
      titulo_generado,
    );
  }

  const { data: articulo, error: insertError } = await supabase
    .from('articulos')
    .insert({
      nota_prensa_id: nota.id,
      medio_id: medio.id,
      titulo_generado,
      contenido_generado: contenidoFinal,
      imagen_destacada_url: imagenes.destacadaUrl,
      estado: 'pendiente_revision',
    })
    .select('id')
    .single();

  if (insertError) throw new Error(insertError.message);

  await supabase.from('notas_prensa').update({ estado: 'procesada' }).eq('id', nota.id);

  return {
    articuloId: articulo.id,
    notaId: nota.id,
    medioId: medio.id,
    medioNombre: medio.nombre,
    titulo: titulo_generado,
    imagen: imagenes.destacadaUrl ?? null,
    imagenesAdicionales: imagenes.adicionalesUrls.length,
  };
}

function esErrorCuotaEnMensaje(mensaje) {
  const msg = String(mensaje ?? '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  );
}

async function reactivarNotasConErrorAutomatico(supabase) {
  let query = supabase
    .from('notas_prensa')
    .select('id, asunto, error_mensaje, fecha_recepcion')
    .eq('estado', 'error_procesamiento')
    .order('fecha_recepcion', { ascending: true })
    .limit(Math.max(MAX_REACTIVAR_ERRORES, 1) * 3);

  let { data: notas, error } = await query;

  if (error && String(error.message).includes('error_mensaje')) {
    ({ data: notas, error } = await supabase
      .from('notas_prensa')
      .select('id, asunto, fecha_recepcion')
      .eq('estado', 'error_procesamiento')
      .order('fecha_recepcion', { ascending: true })
      .limit(Math.max(MAX_REACTIVAR_ERRORES, 1) * 3));
  }

  if (error || !notas?.length) {
    return [];
  }

  const horasEspera = Number(process.env.REINTENTO_ERROR_HORAS ?? 1);
  const reactivadas = [];

  for (const nota of notas) {
    if (reactivadas.length >= MAX_REACTIVAR_ERRORES) break;

    const esCuota = esErrorCuotaEnMensaje(nota.error_mensaje);
    const sinMensaje = !nota.error_mensaje?.trim();
    const edadMs = nota.fecha_recepcion
      ? Date.now() - new Date(nota.fecha_recepcion).getTime()
      : 0;
    const esperaCumplida = edadMs >= horasEspera * 60 * 60 * 1000;

    if (!esCuota && !sinMensaje && !esperaCumplida) {
      continue;
    }

    const payload = { estado: 'recibida', error_mensaje: null };
    let { error: updateError } = await supabase
      .from('notas_prensa')
      .update(payload)
      .eq('id', nota.id)
      .eq('estado', 'error_procesamiento');

    if (updateError && String(updateError.message).includes('error_mensaje')) {
      ({ error: updateError } = await supabase
        .from('notas_prensa')
        .update({ estado: 'recibida' })
        .eq('id', nota.id)
        .eq('estado', 'error_procesamiento'));
    }

    if (updateError) {
      console.error(
        `${ROJO}   ⚠ No se pudo reactivar nota #${nota.id}: ${updateError.message}${RESET}`,
      );
      continue;
    }

    reactivadas.push(nota.id);
    const motivo = esCuota
      ? 'cuota Gemini'
      : sinMensaje
        ? 'error sin detalle'
        : `espera ${horasEspera}h`;
    console.log(`   🔄 Nota #${nota.id} reactivada (${motivo})`);
  }

  return reactivadas;
}

async function procesarPendientes() {
  const supabase = createSupabaseNodeClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  );
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const resultados = [];
  const errores = [];
  const reactivadas = await reactivarNotasConErrorAutomatico(supabase);

  if (reactivadas.length) {
    console.log(
      `   🔄 ${reactivadas.length} nota(s) reactivadas desde error_procesamiento`,
    );
  }

  let procesadasEnRun = 0;

  while (procesadasEnRun < MAX_NOTAS_POR_RUN) {
    const { data: notas } = await supabase
      .from('notas_prensa')
      .select('*')
      .eq('estado', 'recibida')
      .order('fecha_recepcion', { ascending: true })
      .limit(1);

    if (!notas?.length) break;

    const nota = notas[0];
    procesadasEnRun += 1;
    console.log(`   🤖 Procesando nota #${nota.id}...`);

    try {
      const resultado = await procesarUnaNotaConReintentos(supabase, genAI, nota);
      resultados.push(resultado);
      console.log(
        `   ✅ [${resultado.medioNombre}] Artículo #${resultado.articuloId}: ${resultado.titulo.slice(0, 50)}...`,
      );
    } catch (error) {
      if (esErrorCuotaGemini(error)) {
        console.error(
          `${ROJO}   ⏸ Nota #${nota.id}: cuota Gemini agotada. Se reintentará en el próximo pipeline.${RESET}`,
        );
        errores.push({
          notaId: nota.id,
          error: 'Cuota Gemini agotada (429). La nota sigue pendiente.',
          cuota: true,
        });
        break;
      }

      console.error(`${ROJO}   ❌ Nota #${nota.id}: ${error.message}${RESET}`);

      const updatePayload = {
        estado: 'error_procesamiento',
        error_mensaje: String(error.message).slice(0, 2000),
      };

      let { error: updateError } = await supabase
        .from('notas_prensa')
        .update(updatePayload)
        .eq('id', nota.id);

      if (updateError && String(updateError.message).includes('error_mensaje')) {
        ({ error: updateError } = await supabase
          .from('notas_prensa')
          .update({ estado: 'error_procesamiento' })
          .eq('id', nota.id));
      }

      if (updateError) {
        console.error(`${ROJO}   ⚠ No se pudo marcar error en nota #${nota.id}: ${updateError.message}${RESET}`);
      }

      errores.push({ notaId: nota.id, error: error.message });
    }
  }

  return { resultados, errores, reactivadas };
}

module.exports = { procesarPendientes };