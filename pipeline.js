require('dotenv').config();

const { ensureWebSocketPolyfill } = require('./lib/supabaseNode.cjs');
ensureWebSocketPolyfill();

const { procesarBandejaPop3 } = require('./lib/receptorPop3.cjs');
const { procesarPendientes } = require('./lib/procesadorCore.cjs');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://procesador-notas.vercel.app';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  🚀 PIPELINE AUTOMÁTICO — Todos los medios');
  console.log('═══════════════════════════════════════════');
  console.log('');

  let huboErrores = false;

  console.log('📥 PASO 1/2 — Leer emails e imágenes');
  let emailStats = { nuevas: 0, duplicadas: 0, imagenes: 0, medios: [] };

  try {
    emailStats = await procesarBandejaPop3();
    if (emailStats.medios?.length) {
      emailStats.medios.forEach((m) => {
        if (m.error) {
          console.log(`   → ${m.medio}: ERROR — ${m.error}`);
          huboErrores = true;
        } else {
          console.log(`   → ${m.medio}: ${m.nuevas} nuevos, ${m.duplicadas} duplicados`);
        }
      });
    }
    console.log(`   → Total: ${emailStats.nuevas} emails | ${emailStats.imagenes} imágenes`);
  } catch (error) {
    huboErrores = true;
    console.error(`   ❌ Error en ingesta POP3: ${error.message}`);
  }

  console.log('');

  console.log('🤖 PASO 2/2 — Generar artículos con IA');
  let articulos = [];
  let erroresGemini = [];

  try {
    const resultado = await procesarPendientes();
    articulos = resultado.resultados ?? [];
    erroresGemini = resultado.errores ?? [];

    if (articulos.length === 0 && erroresGemini.length === 0) {
      console.log('   → No había notas pendientes de procesar.');
    } else {
      articulos.forEach((a) => {
        console.log(`   → [${a.medioNombre}] Artículo #${a.articuloId}${a.imagen ? ' (con imagen)' : ''}`);
      });
      erroresGemini.forEach((e) => {
        console.log(`   → Nota #${e.notaId}: ERROR — ${e.error}`);
        huboErrores = true;
      });
    }
  } catch (error) {
    huboErrores = true;
    console.error(`   ❌ Error en procesamiento Gemini: ${error.message}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  if (huboErrores) {
    console.log('  ⚠️  PIPELINE COMPLETADO CON ERRORES');
  } else {
    console.log('  ✅ PIPELINE COMPLETADO');
  }
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log(`   Artículos listos en dashboard: ${articulos.length}`);
  console.log(`   Abre: ${DASHBOARD_URL}`);
  console.log('');

  if (huboErrores) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('❌ Error fatal en pipeline:', error.message);
  process.exit(1);
});
