/**
 * Guarda credenciales WordPress REST en la tabla medios (por slug).
 *
 * Opción A — mismo usuario en las 4 webs y MISMA contraseña de aplicación en todas
 *   (solo si en cada WP creaste la misma app password, lo habitual es una distinta por sitio):
 *   WP_API_USER + WP_API_PASSWORD en .env → npm run configurar-wordpress-medios
 *
 * Opción B — recomendada: wordpress-medios.json (copia desde wordpress-medios.example.json)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SLUGS = ['travelicius', 'vidaystyle', 'glamcloset', 'femnegoci'];

function cargarCredencialesPorSlug() {
  const jsonPath = path.join(__dirname, '..', 'wordpress-medios.json');
  if (fs.existsSync(jsonPath)) {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const out = {};
    for (const slug of SLUGS) {
      const row = raw[slug];
      if (row?.api_user && row?.api_password) {
        out[slug] = {
          api_user: String(row.api_user).trim(),
          api_password: String(row.api_password).trim(),
        };
      }
    }
    if (Object.keys(out).length) return out;
  }

  const user = process.env.WP_API_USER?.trim();
  const pass = process.env.WP_API_PASSWORD?.trim();
  if (user && pass) {
    const out = {};
    for (const slug of SLUGS) {
      out[slug] = { api_user: user, api_password: pass };
    }
    return out;
  }

  return null;
}

async function main() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env');
  }

  const creds = cargarCredencialesPorSlug();
  if (!creds) {
    console.error('❌ No hay credenciales WordPress.');
    console.error('');
    console.error('   Opción fácil (4 sitios):');
    console.error('   1. Copia wordpress-medios.example.json → wordpress-medios.json');
    console.error('   2. NO hace falta crear usuario nuevo. Usa tu admin/editor existente:');
    console.error('      Perfil → Contraseñas de aplicación → Añadir ("Panel editorial")');
    console.error('   3. api_user = nombre de login de ESE usuario (Usuarios → columna "Nombre de usuario")');
    console.error('   4. api_password = la clave que genera WP (distinta en cada web)');
    console.error('   4. Vuelve a ejecutar: npm run configurar-wordpress-medios');
    console.error('');
    console.error('   Opción rápida (solo si la MISMA app password vale en las 4):');
    console.error('   WP_API_USER y WP_API_PASSWORD en .env');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  for (const slug of SLUGS) {
    const c = creds[slug];
    if (!c) {
      console.log(`⏭️  ${slug}: sin credenciales en json/env`);
      continue;
    }

    const { data, error } = await supabase
      .from('medios')
      .update({
        api_user: c.api_user,
        api_password: c.api_password.replace(/\s+/g, ' ').trim(),
      })
      .eq('slug', slug)
      .select('id, slug, url_wordpress, api_user')
      .maybeSingle();

    if (error) throw new Error(`${slug}: ${error.message}`);
    if (!data) throw new Error(`${slug}: medio no encontrado en Supabase`);
    console.log(`✅ ${slug} → ${data.url_wordpress} (usuario ${data.api_user})`);
  }

  console.log('\nListo. Prueba publicar de nuevo en el panel.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
