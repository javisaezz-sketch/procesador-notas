/**
 * Comprueba señales locales de uso (Storage, filas) y opcionalmente API counts.
 * El egress en GB solo está en el dashboard → Usage (no hay clave de proyecto para eso).
 *
 * .env opcional:
 *   SUPABASE_ACCESS_TOKEN — token de cuenta en supabase.com/dashboard/account/tokens
 *     (permiso analytics_usage_read) para ver picos de peticiones REST/Storage.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const STORAGE_WARN_MB = Number(process.env.SUPABASE_STORAGE_WARN_MB ?? 800);
const STORAGE_CRIT_MB = Number(process.env.SUPABASE_STORAGE_CRIT_MB ?? 2000);

function projectRefFromUrl(urlRaw) {
  const u = urlRaw?.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/i, '');
  const m = u?.match(/https:\/\/([^.]+)\.supabase\.co/i);
  return m?.[1] ?? null;
}

async function sumStorageBytes(supabase, prefix = '') {
  let files = 0;
  let bytes = 0;

  const { data, error } = await supabase.storage.from('notas-prensa').list(prefix, {
    limit: 1000,
  });
  if (error) throw new Error(`Storage list: ${error.message}`);

  for (const entry of data ?? []) {
    if (entry.id) {
      files += 1;
      bytes += entry.metadata?.size ?? 0;
    } else if (entry.name) {
      const sub = prefix ? `${prefix}/${entry.name}` : entry.name;
      const nested = await sumStorageBytes(supabase, sub);
      files += nested.files;
      bytes += nested.bytes;
    }
  }

  return { files, bytes };
}

async function fetchApiUsageCounts(ref, token) {
  const url = new URL(
    `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/usage.api-counts`,
  );
  url.searchParams.set('interval', '1d');

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Management API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  const url = process.env.SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    console.error('Faltan SUPABASE_URL o clave en .env');
    process.exit(2);
  }

  const ref = projectRefFromUrl(url);
  const usageUrl = ref
    ? `https://supabase.com/dashboard/project/${ref}/settings/billing/usage`
    : 'https://supabase.com/dashboard/org/_/usage';

  const supabase = createClient(url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, ''), key);

  const lines = [];
  let level = 0; // 0 ok, 1 warn, 2 crit

  lines.push('Revisión Supabase (semanal)');
  lines.push('');
  lines.push(`Proyecto: ${ref ?? '?'}`);
  lines.push(`Usage (Egress en GB): ${usageUrl}`);
  lines.push('');

  for (const table of ['notas_prensa', 'articulos', 'notas_prensa_imagenes']) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) lines.push(`${table}: error (${error.message})`);
    else lines.push(`${table}: ${count ?? 0} filas`);
  }

  let storage = { files: 0, bytes: 0 };
  try {
    storage = await sumStorageBytes(supabase);
  } catch (e) {
    lines.push(`Storage notas-prensa: error (${e.message})`);
  }

  const storageMb = storage.bytes / (1024 * 1024);
  lines.push(
    `Storage notas-prensa: ${storage.files} archivos, ~${storageMb.toFixed(1)} MB`,
  );

  if (storageMb >= STORAGE_CRIT_MB) {
    level = Math.max(level, 2);
    lines.push(`⚠️ Storage alto (>${STORAGE_CRIT_MB} MB). Revisa limpieza / npm run limpiar-supabase`);
  } else if (storageMb >= STORAGE_WARN_MB) {
    level = Math.max(level, 1);
    lines.push(`⚠️ Storage subiendo (>${STORAGE_WARN_MB} MB). Mira Usage en el dashboard.`);
  }

  const mgmt = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (mgmt && ref) {
    try {
      const usage = await fetchApiUsageCounts(ref, mgmt);
      const points = usage?.result ?? [];
      const last = points[points.length - 1];
      if (last) {
        lines.push('');
        lines.push('Peticiones (último día, proxy de actividad):');
        lines.push(`  REST: ${last.total_rest_requests ?? '?'}`);
        lines.push(`  Storage: ${last.total_storage_requests ?? '?'}`);
        lines.push(`  Auth: ${last.total_auth_requests ?? '?'}`);
      }
    } catch (e) {
      lines.push('');
      lines.push(`(Token cuenta: no pude leer analytics — ${e.message})`);
    }
  } else {
    lines.push('');
    lines.push('En el dashboard mira: Egress, Storage size, Database size.');
    lines.push('Alerta manual: si Egress > ~3–4 GB en el ciclo, avisa.');
    lines.push('Opcional: SUPABASE_ACCESS_TOKEN en .env (token de cuenta Supabase).');
  }

  lines.push('');
  lines.push('Bucket debe seguir privado (public=false).');

  const text = lines.join('\n');
  console.log(text);

  const outPath = path.join(__dirname, '..', 'ultimo-chequeo-supabase.txt');
  require('fs').writeFileSync(outPath, `${new Date().toISOString()}\n\n${text}`, 'utf8');

  process.exit(level);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(2);
});
