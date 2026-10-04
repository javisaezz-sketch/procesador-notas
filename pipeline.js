require('dotenv').config();

const fs = require('fs');
const { ensureWebSocketPolyfill } = require('./lib/supabaseNode.cjs');

ensureWebSocketPolyfill();

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://panel-editorial.vercel.app';
const SUMMARY_FILE = 'pipeline-summary.json';

function guardarResumen(resumen) {
  try {
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify({ ...resumen, dashboardUrl: DASHBOARD_URL }, null, 2));
  } catch (error) {
    console.error(`No se pudo guardar ${SUMMARY_FILE}: ${error.message}`);
  }
}

async function main() {
  const { ejecutarPipeline } = await import('./lib/ejecutarPipeline.js');
  const resumen = await ejecutarPipeline({ vaciarCola: true });
  guardarResumen(resumen);

  if (!resumen.ok) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  const resumenFatal = {
    ok: false,
    fatal: { fase: 'pipeline', error: error.message },
    advertencias: [],
    emails: null,
    articulosGenerados: 0,
    dashboardUrl: DASHBOARD_URL,
  };

  guardarResumen(resumenFatal);

  try {
    const { savePipelineEstado } = await import('./lib/pipelineEstado.js');
    await savePipelineEstado(resumenFatal);
  } catch (saveError) {
    console.error(`No se pudo guardar estado en Supabase: ${saveError.message}`);
  }

  console.error('Error fatal en pipeline:', error.message);
  process.exit(1);
});
