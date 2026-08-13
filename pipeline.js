require('dotenv').config();

const { procesarBandejaPop3 } = require('./lib/receptorPop3.cjs');
const { procesarPendientes } = require('./lib/procesadorCore.cjs');

const DASHBOARD_URL = 'http://127.0.0.1:3001';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  🚀 PIPELINE AUTOMÁTICO — Todos los medios');
  console.log('═══════════════════════════════════════════');
  console.log('');

  console.log('📥 PASO 1/2 — Leer emails e imágenes');
  const emailStats = await procesarBandejaPop3();
  if (emailStats.medios?.length) {
    emailStats.medios.forEach((m) => {
      console.log(`   → ${m.medio}: ${m.nuevas} nuevos, ${m.duplicadas} duplicados`);
    });
  }
  console.log(`   → Total: ${emailStats.nuevas} emails | ${emailStats.imagenes} imágenes`);
  console.log('');

  console.log('🤖 PASO 2/2 — Generar artículos con IA');
  const articulos = await procesarPendientes();

  if (articulos.length === 0) {
    console.log('   → No había notas pendientes de procesar.');
  } else {
    articulos.forEach((a) => {
      console.log(`   → [${a.medioNombre}] Artículo #${a.articuloId}${a.imagen ? ' (con imagen)' : ''}`);
    });
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  ✅ PIPELINE COMPLETADO');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log(`   Artículos listos en dashboard: ${articulos.length}`);
  console.log(`   Abre: ${DASHBOARD_URL}`);
  console.log('');
  console.log('   (Si el dashboard no carga, ejecuta: npm.cmd run dev)');
  console.log('');
}

main().catch((error) => {
  console.error('❌ Error en pipeline:', error.message);
  process.exit(1);
});
