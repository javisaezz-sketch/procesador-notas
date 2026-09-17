require('dotenv').config();
const dns = require('dns').promises;
const { URL } = require('url');

async function main() {
  const urlRaw = process.env.SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();

  if (!urlRaw || !key) {
    console.error('❌ Faltan SUPABASE_URL o clave (service role / anon).');
    process.exit(1);
  }

  let hostname;

  try {
    hostname = new URL(urlRaw).hostname;
  } catch {
    console.error(`❌ SUPABASE_URL no es válida: ${urlRaw}`);
    process.exit(1);
  }

  try {
    await dns.lookup(hostname);
  } catch (error) {
    console.error(`❌ No se resuelve el host de Supabase: ${hostname}`);
    console.error(`   (${error.code ?? error.message})`);
    console.error('');
    console.error('   Suele significar que el proyecto fue pausado, eliminado o cambió de URL.');
    console.error('   Entra en https://supabase.com/dashboard → copia la nueva Project URL');
    console.error('   y actualízala en GitHub Secrets y en Vercel.');
    process.exit(1);
  }

  try {
    const response = await fetch(`${urlRaw.replace(/\/+$/, '')}/rest/v1/medios?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (response.status === 402) {
      console.error('❌ Supabase respondió 402 (cuota / facturación). Revisa Usage en el dashboard.');
      process.exit(1);
    }

    if (!response.ok) {
      const body = await response.text();
      console.error(`❌ Supabase API ${response.status}: ${body.slice(0, 200)}`);
      process.exit(1);
    }

    console.log(`✅ Supabase accesible (${hostname})`);
  } catch (error) {
    const cause = error.cause?.message || error.cause?.code || '';
    console.error(`❌ No se pudo conectar a Supabase: ${error.message}${cause ? ` (${cause})` : ''}`);
    process.exit(1);
  }
}

main();
