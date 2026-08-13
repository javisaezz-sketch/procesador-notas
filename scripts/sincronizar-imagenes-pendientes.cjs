require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );

  const { sincronizarImagenesPendientes } = await import('../lib/imagenes.js');
  const resultados = await sincronizarImagenesPendientes(supabase);

  if (!resultados.length) {
    console.log('No hay artículos pendientes de revisión.');
    return;
  }

  console.log(`Sincronizados ${resultados.length} artículo(s) en todos los medios:\n`);

  for (const item of resultados) {
    const extra =
      item.imagenesAdicionales > 0
        ? ` + ${item.imagenesAdicionales} en galería`
        : '';
    console.log(`  #${item.id} [${item.medio}] ${item.titulo.slice(0, 60)}${extra}`);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
