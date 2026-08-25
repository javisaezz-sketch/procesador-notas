require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function listarNotasParaLimpiar(supabase) {
  const ids = new Set();

  const { data: articulos, error: articulosError } = await supabase
    .from('articulos')
    .select('nota_prensa_id')
    .in('estado', ['publicado', 'anulado'])
    .not('nota_prensa_id', 'is', null);

  if (articulosError) {
    throw new Error(`Error al leer artículos: ${articulosError.message}`);
  }

  for (const articulo of articulos ?? []) {
    ids.add(articulo.nota_prensa_id);
  }

  const { data: descartadas, error: descartadasError } = await supabase
    .from('notas_prensa')
    .select('id')
    .eq('estado', 'descartada');

  if (descartadasError) {
    throw new Error(`Error al leer notas descartadas: ${descartadasError.message}`);
  }

  for (const nota of descartadas ?? []) {
    ids.add(nota.id);
  }

  return [...ids];
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env');
  }

  const supabase = createClient(url, key);
  const { limpiarRecursosNota } = await import('../lib/limpiarAlmacenNota.js');

  const notaIds = await listarNotasParaLimpiar(supabase);

  if (!notaIds.length) {
    console.log('No hay notas publicadas/anuladas/descartadas para limpiar.');
    return;
  }

  console.log(`Limpiando ${notaIds.length} nota(s)...\n`);

  let totalArchivos = 0;
  let totalRegistros = 0;
  let totalHtml = 0;
  let errores = 0;

  for (const notaId of notaIds) {
    try {
      const resultado = await limpiarRecursosNota(supabase, notaId);

      if (
        resultado.archivosEliminados ||
        resultado.registrosImagenes ||
        resultado.htmlVaciado
      ) {
        console.log(
          `  Nota #${notaId}: ${resultado.archivosEliminados} archivo(s), ` +
            `${resultado.registrosImagenes} registro(s), HTML ${resultado.htmlVaciado ? 'vaciado' : 'sin cambios'}`,
        );
      }

      totalArchivos += resultado.archivosEliminados;
      totalRegistros += resultado.registrosImagenes;
      if (resultado.htmlVaciado) totalHtml += 1;
    } catch (error) {
      errores += 1;
      console.warn(`  Nota #${notaId}: ERROR — ${error.message}`);
    }
  }

  console.log('');
  console.log('Resumen:');
  console.log(`  Archivos borrados en Storage: ${totalArchivos}`);
  console.log(`  Registros borrados en BD: ${totalRegistros}`);
  console.log(`  Notas con HTML vaciado: ${totalHtml}`);
  if (errores) {
    console.log(`  Errores: ${errores}`);
  }
  console.log('');
  console.log('Revisa en Supabase → Project Settings → Usage cuánto bajó la cuota.');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
