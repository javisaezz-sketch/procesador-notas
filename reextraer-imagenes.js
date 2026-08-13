require('dotenv').config();

async function main() {
  const notaId = Number(process.argv[2]);

  if (!notaId) {
    console.error('Uso: node reextraer-imagenes.js <nota_prensa_id>');
    console.error('Ejemplo: node reextraer-imagenes.js 2');
    process.exit(1);
  }

  const { reextraerImagenesNota } = await import('./lib/extraerImagenesEmail.js');
  const urls = await reextraerImagenesNota(notaId);

  console.log(`✅ Imágenes extraídas del HTML: ${urls.length}`);
  urls.forEach((url) => console.log(`   ${url}`));
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
