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

Nota de prensa:
Remitente: ${nota.remitente ?? 'No indicado'}
Asunto: ${getNotaTitulo(nota)}
Contenido:
${notaTexto}

Responde ÚNICAMENTE con JSON válido:
{"titulo_generado":"...","contenido_generado":"<article><p>Lead...</p><h2>Subtítulo</h2>...</article>"}
`.trim();

  const result = await model.generateContent(prompt);
  const { titulo_generado, contenido_generado } = parseGeminiResponse(
    result.response.text(),
  );

  const { resolverImagenesParaArticulo } = await import('./imagenes.js');
  const {
    quitarImagenIncrustada,
    quitarImagenesGaleria,
    inyectarImagenesAlFinal,
  } = await import('./contenidoHtml.js');

  const imagenes = await resolverImagenesParaArticulo(supabase, {
    notaPrensaId: nota.id,
    medioId: medio.id,
    contenidoHtml: nota.contenido_html,
  });

  let contenidoFinal = quitarImagenesGaleria(
    quitarImagenIncrustada(contenido_generado),
  );

  if (imagenes.adicionalesUrls.length) {
    contenidoFinal = inyectarImagenesAlFinal(
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

async function procesarPendientes() {
  const supabase = createSupabaseNodeClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  );
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const resultados = [];
  const errores = [];

  while (true) {
    const { data: notas } = await supabase
      .from('notas_prensa')
      .select('*')
      .eq('estado', 'recibida')
      .order('fecha_recepcion', { ascending: true })
      .limit(1);

    if (!notas?.length) break;

    const nota = notas[0];
    console.log(`   🤖 Procesando nota #${nota.id}...`);

    try {
      const resultado = await procesarUnaNota(supabase, genAI, nota);
      resultados.push(resultado);
      console.log(
        `   ✅ [${resultado.medioNombre}] Artículo #${resultado.articuloId}: ${resultado.titulo.slice(0, 50)}...`,
      );
    } catch (error) {
      console.error(`${ROJO}   ❌ Nota #${nota.id}: ${error.message}${RESET}`);

      const updatePayload = { estado: 'error_procesamiento' };
      const { error: updateError } = await supabase
        .from('notas_prensa')
        .update(updatePayload)
        .eq('id', nota.id);

      if (updateError) {
        console.error(`${ROJO}   ⚠ No se pudo marcar error en nota #${nota.id}: ${updateError.message}${RESET}`);
      }

      errores.push({ notaId: nota.id, error: error.message });
    }
  }

  return { resultados, errores };
}

module.exports = { procesarPendientes };
