/**
 * Renombra el proyecto en Vercel a panel-editorial.
 *
 * Uso:
 *   set VERCEL_TOKEN=tu_token
 *   node scripts/renombrar-proyecto-vercel.cjs
 *
 * Token: https://vercel.com/account/tokens
 */
require('dotenv').config();

const TOKEN = process.env.VERCEL_TOKEN;
const OLD_NAME = process.env.VERCEL_PROJECT_OLD_NAME || 'procesador-notas';
const NEW_NAME = process.env.VERCEL_PROJECT_NEW_NAME || 'panel-editorial';
const TEAM_ID = process.env.VERCEL_TEAM_ID || '';

if (!TOKEN) {
  console.error('Falta VERCEL_TOKEN. Créalo en https://vercel.com/account/tokens');
  process.exit(1);
}

async function api(path, options = {}) {
  const url = `https://api.vercel.com${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `HTTP ${response.status}`);
  }

  return body;
}

(async () => {
  const teamQuery = TEAM_ID ? `?teamId=${encodeURIComponent(TEAM_ID)}` : '';

  let project;

  try {
    project = await api(`/v9/projects/${encodeURIComponent(OLD_NAME)}${teamQuery}`);
  } catch (error) {
    console.error(`No se encontró el proyecto "${OLD_NAME}": ${error.message}`);
    process.exit(1);
  }

  if (project.name === NEW_NAME) {
    console.log(`El proyecto ya se llama "${NEW_NAME}".`);
    console.log(`URL: https://${NEW_NAME}.vercel.app`);
    return;
  }

  const updated = await api(`/v9/projects/${project.id}${teamQuery}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: NEW_NAME }),
  });

  console.log(`Renombrado: ${project.name} → ${updated.name}`);
  console.log(`URL: https://${updated.name}.vercel.app`);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
