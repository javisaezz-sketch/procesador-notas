require('dotenv').config();

const fs = require('fs');

const { ensureWebSocketPolyfill } = require('./lib/supabaseNode.cjs');
ensureWebSocketPolyfill();

const { procesarBandejaPop3 } = require('./lib/receptorPop3.cjs');
const { procesarPendientes } = require('./lib/procesadorCore.cjs');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://procesador-notas.vercel.app';
const SUMMARY_FILE = 'pipeline-summary.json';

function guardarResumen(resumen) {
  try {
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(resumen, null, 2));
  } catch (error) {
    console.error(`No se pudo guardar ${SUMMARY_FILE}: ${error.message}`);
  }
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  🚀 PIPELINE AUTOMÁTICO — Todos los medios');
  console.log('═══════════════════════════════════════════');
  console.log('');

  const advertencias = [];
  let errorFatal = null;

  console.log('📥 PASO 1/2 — Leer emails e imágenes');
  let emailStats = { nuevas: 0, duplicadas: 0, imagenes: 0, medios: [] };

  try {
    emailStats = await procesarBandejaPop3();
    if (emailStats.medios?.length) {
      emailStats.medios.forEach((m) => {
        if (m.error) {
          console.log(`   → ${m.medio}: ERROR — ${m.error}`);
          advertencias.push({ fase: 'pop3', medio: m.medio, error: m.error });
        } else {
          console.log(`   → ${m.medio}: ${m.nuevas} nuevos, ${m.duplicadas} duplicados`);
        }
      });
    }
    console.log(`   → Total: ${emailStats.nuevas} emails | ${emailStats.imagenes} imágenes`);
  } catch (error) {
    errorFatal = { fase: 'pop3', error: error.message };
    console.error(`   ❌ Error en ingesta POP3: ${error.message}`);
  }

  console.log('');

  console.log('🤖 PASO 2/2 — Generar artículos con IA');
  let articulos = [];
  let erroresGemini = [];
  let notasReactivadas = 0;

  try {
    const resultado = await procesarPendientes();
    articulos = resultado.resultados ?? [];
    erroresGemini = resultado.errores ?? [];
    notasReactivadas = resultado.reactivadas?.length ?? 0;

    if (notasReactivadas > 0) {
      console.log(`   → ${notasReactivadas} nota(s) reactivadas automáticamente desde Errores IA`);
    }

    if (articulos.length === 0 && erroresGemini.length === 0 && notasReactivadas === 0) {
      console.log('   → No había notas pendientes de procesar.');
    } else {
      articulos.forEach((a) => {
        console.log(
          `   → [${a.medioNombre}] Artículo #${a.articuloId}${a.imagen ? ' (con imagen)' : ''}`,
        );
      });
      erroresGemini.forEach((e) => {
        console.log(`   → Nota #${e.notaId}: ERROR — ${e.error}`);
        advertencias.push({ fase: 'gemini', notaId: e.notaId, error: e.error });
      });
    }
  } catch (error) {
    errorFatal = { fase: 'gemini', error: error.message };
    console.error(`   ❌ Error en procesamiento Gemini: ${error.message}`);
  }

  const mediosPop3 = emailStats.medios ?? [];
  const mediosConError =
    mediosPop3.length > 0 && mediosPop3.every((medio) => Boolean(medio.error));

  if (mediosConError && !errorFatal) {
    errorFatal = {
      fase: 'pop3',
      error: 'Todos los buzones POP3 fallaron',
    };
  }

  const resumen = {
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
    dashboardUrl: DASHBOARD_URL,
  };

  guardarResumen(resumen);

  console.log('');
  console.log('═══════════════════════════════════════════');
  if (errorFatal) {
    console.log('  ❌ PIPELINE FALLIDO');
  } else if (advertencias.length) {
    console.log('  ⚠️  PIPELINE COMPLETADO CON AVISOS');
  } else {
    console.log('  ✅ PIPELINE COMPLETADO');
  }
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log(`   Artículos listos en dashboard: ${articulos.length}`);
  console.log(`   Abre: ${DASHBOARD_URL}`);
  console.log('');

  if (advertencias.length) {
    console.log('   Avisos:');
    advertencias.forEach((item) => {
      if (item.medio) {
        console.log(`   - POP3 ${item.medio}: ${item.error}`);
      } else if (item.notaId) {
        console.log(`   - Gemini nota #${item.notaId}: ${item.error}`);
      }
    });
    console.log('');
  }

  if (errorFatal) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  guardarResumen({
    ok: false,
    fatal: { fase: 'pipeline', error: error.message },
    advertencias: [],
    emails: null,
    articulosGenerados: 0,
    dashboardUrl: DASHBOARD_URL,
  });
  console.error('❌ Error fatal en pipeline:', error.message);
  process.exit(1);
});
