require('dotenv').config();

const { procesarPendientes } = require('./lib/procesadorCore.cjs');

procesarPendientes()
  .then((resultados) => {
    if (!resultados.length) {
      console.log('No hay notas con estado "recibida".');
      process.exit(0);
    }
    console.log(`✅ ${resultados.length} artículo(s) generado(s)`);
    resultados.forEach((r) => console.log(`   #${r.articuloId} — ${r.titulo}`));
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
