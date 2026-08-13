require('dotenv').config();

const { procesarBandejaPop3 } = require('./lib/receptorPop3.cjs');

procesarBandejaPop3()
  .then((stats) => {
    console.log(`\nResumen: ${stats.nuevas} nuevas, ${stats.duplicadas} duplicadas, ${stats.imagenes} imágenes`);
  })
  .catch((error) => {
    console.error('❌ Error en receptor-email:', error.message);
    process.exit(1);
  });
