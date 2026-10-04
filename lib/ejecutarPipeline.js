import { procesarBandejaPop3 } from './receptorPop3.cjs';
import { procesarPendientes } from './procesadorCore.cjs';
import { publicarProgramados } from './programarPublicacion.js';
import { reservarPipeline, savePipelineEstado } from './pipelineEstado.js';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://panel-editorial.vercel.app';

function resumenVacio(extra = {}) {
  return {
    ok: true,
    ocupado: false,
    fatal: null,
    advertencias: [],
    emails: { nuevas: 0, duplicadas: 0, imagenes: 0 },
    articulosGenerados: 0,
    notasReactivadas: 0,
    quedanNotas: false,
    dashboardUrl: DASHBOARD_URL,
    ...extra,
  };
}

export async function ejecutarPipeline({ vaciarCola = false } = {}) {
  let reservado = true;
  try {
    reservado = await reservarPipeline();
  } catch (error) {
    console.error(`No se pudo reservar el pipeline: ${error.message}`);
  }

  if (!reservado) {
    return resumenVacio({
      ocupado: true,
      advertencias: [{ fase: 'pipeline', error: 'Ya hay un pipeline en marcha' }],
    });
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  PIPELINE — Todos los medios');
  console.log('═══════════════════════════════════════════');
  console.log('');

  const advertencias = [];
  let errorFatal = null;
  let emailStats = { nuevas: 0, duplicadas: 0, imagenes: 0, medios: [] };
  let articulos = [];
  let notasReactivadas = 0;
  let quedanNotas = false;

  console.log('PASO 1/2 — Leer emails e imágenes');
  try {
    emailStats = await procesarBandejaPop3();
    for (const medio of emailStats.medios || []) {
      if (medio.error) {
        console.log(`   → ${medio.medio}: ERROR — ${medio.error}`);
        advertencias.push({ fase: 'pop3', medio: medio.medio, error: medio.error });
      } else {
        console.log(`   → ${medio.medio}: ${medio.nuevas} nuevos, ${medio.duplicadas} duplicados`);
      }
    }
    console.log(`   → Total: ${emailStats.nuevas} emails | ${emailStats.imagenes} imágenes`);
  } catch (error) {
    errorFatal = { fase: 'pop3', error: error.message };
    console.error(`   Error en ingesta POP3: ${error.message}`);
  }

  console.log('');
  console.log('Publicaciones programadas');
  try {
    const programados = await publicarProgramados();
    if (programados.publicados.length) {
      for (const item of programados.publicados) {
        console.log(`   → Publicado #${item.id}: ${item.titulo}`);
      }
    } else if (!programados.errores.length) {
      console.log('   → No había publicaciones pendientes de hora.');
    }
    for (const item of programados.errores) {
      advertencias.push({ fase: 'programados', notaId: item.id, error: item.error });
    }
  } catch (error) {
    console.error(`   Error en publicaciones programadas: ${error.message}`);
    advertencias.push({ fase: 'programados', error: error.message });
  }

  console.log('');
  console.log('PASO 2/2 — Generar artículos con IA');
  const porPasada = 4;
  try {
    let pasadas = 0;
    do {
      pasadas += 1;
      const resultado = await procesarPendientes({ maxNotas: porPasada });
      articulos = articulos.concat(resultado.resultados ?? []);
      notasReactivadas += resultado.reactivadas?.length ?? 0;
      quedanNotas = Boolean(resultado.quedan);

      if ((resultado.reactivadas?.length ?? 0) > 0) {
        console.log(`   → ${resultado.reactivadas.length} nota(s) reactivadas desde Errores IA`);
      }

      for (const articulo of resultado.resultados ?? []) {
        console.log(`   → [${articulo.medioNombre}] Artículo #${articulo.articuloId}`);
      }
      for (const fallo of resultado.errores || []) {
        console.log(`   → Nota #${fallo.notaId}: ERROR — ${fallo.error}`);
        advertencias.push({ fase: 'gemini', notaId: fallo.notaId, error: fallo.error });
      }

      if (!vaciarCola || pasadas >= 4) break;
    } while (quedanNotas && !errorFatal);

    if (articulos.length === 0 && advertencias.every((item) => item.fase !== 'gemini') && notasReactivadas === 0) {
      console.log('   → No había notas pendientes de procesar.');
    }
  } catch (error) {
    errorFatal = { fase: 'gemini', error: error.message };
    console.error(`   Error en procesamiento Gemini: ${error.message}`);
  }

  const mediosPop3 = emailStats.medios ?? [];
  const mediosConError = mediosPop3.length > 0 && mediosPop3.every((medio) => Boolean(medio.error));
  if (mediosConError && !errorFatal) {
    errorFatal = { fase: 'pop3', error: 'Todos los buzones POP3 fallaron' };
  }

  const resumen = resumenVacio({
    ok: !errorFatal,
    fatal: errorFatal,
    advertencias,
    emails: {
      nuevas: emailStats.nuevas,
      duplicadas: emailStats.duplicadas,
      imagenes: emailStats.imagenes,
    },
    articulosGenerados: articulos.length,
    notasReactivadas,
    quedanNotas,
  });

  try {
    await savePipelineEstado(resumen);
  } catch (error) {
    console.error(`No se pudo guardar estado en Supabase: ${error.message}`);
  }

  console.log('');
  console.log(errorFatal ? 'PIPELINE FALLIDO' : advertencias.length ? 'PIPELINE COMPLETADO CON AVISOS' : 'PIPELINE COMPLETADO');
  console.log(`   Artículos listos: ${articulos.length}`);
  console.log('');

  return resumen;
}
