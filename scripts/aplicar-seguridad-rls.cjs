require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function obtenerConfiguracionDb() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  const password = process.env.SUPABASE_DB_PASSWORD;
  const url = process.env.SUPABASE_URL;

  if (!password || !url) {
    throw new Error(
      'Falta DATABASE_URL o SUPABASE_DB_PASSWORD en .env para ejecutar SQL de administración.',
    );
  }

  const ref = url.replace(/^https:\/\//, '').split('.')[0];

  return {
    host: process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`,
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    user: process.env.SUPABASE_DB_USER || 'postgres',
    password,
    database: process.env.SUPABASE_DB_NAME || 'postgres',
    ssl: { rejectUnauthorized: false },
  };
}

function sqlEjecutable(contenido) {
  const lineas = [];
  let bloque = [];

  for (const linea of contenido.split(/\r?\n/)) {
    const limpia = linea.trim();

    if (!limpia || limpia.startsWith('--')) {
      continue;
    }

    bloque.push(linea);

    if (limpia.endsWith(';')) {
      lineas.push(bloque.join('\n'));
      bloque = [];
    }
  }

  if (bloque.length) {
    lineas.push(bloque.join('\n'));
  }

  return lineas;
}

async function main() {
  const sqlPath = path.join(__dirname, '..', 'supabase-seguridad-rls.sql');
  const contenido = fs.readFileSync(sqlPath, 'utf8');
  const statements = sqlEjecutable(contenido);

  const client = new Client(obtenerConfiguracionDb());
  await client.connect();

  try {
    for (const statement of statements) {
      console.log(`→ ${statement.split('\n')[0].slice(0, 80)}...`);
      await client.query(statement);
    }

    const { rows } = await client.query(`
      SELECT c.relname AS tabla, c.relrowsecurity AS rls_activo
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname IN (
          'notas_prensa',
          'articulos',
          'notas_prensa_imagenes',
          'imagenes',
          'medios',
          'pipeline_estado'
        )
      ORDER BY c.relname;
    `);

    console.log('\nEstado RLS:');
    for (const row of rows) {
      console.log(`  ${row.tabla}: ${row.rls_activo ? 'activado' : 'desactivado'}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
