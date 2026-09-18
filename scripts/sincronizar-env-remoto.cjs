/**
 * Sincroniza variables de .env → GitHub Actions secrets + Vercel env.
 * Requiere GITHUB_TOKEN y VERCEL_TOKEN en .env (no commitear).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const REPO = process.env.GITHUB_REPO || 'javisaezz-sketch/procesador-notas';
const VERCEL_PROJECT = process.env.VERCEL_PROJECT || 'panel-editorial';

const SYNC_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
];

/** Solo Vercel (login del panel) */
const VERCEL_DASHBOARD_KEYS = ['DASHBOARD_USER', 'DASHBOARD_PASSWORD'];

async function encryptGithubSecret(publicKey, secretValue) {
  const sodium = require('libsodium-wrappers');
  await sodium.ready;
  const key = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  const messageBytes = sodium.from_string(secretValue);
  const encryptedBytes = sodium.crypto_box_seal(messageBytes, key);
  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
}

async function setGithubSecret(name, value, token) {
  const [owner, repo] = REPO.split('/');
  const keyRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (!keyRes.ok) {
    const body = await keyRes.text();
    throw new Error(`GitHub public-key (${keyRes.status}): ${body}`);
  }
  const { key_id, key } = await keyRes.json();
  const encrypted_value = await encryptGithubSecret(key, value);

  const putRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${name}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ encrypted_value, key_id }),
    },
  );
  if (!putRes.ok) {
    const body = await putRes.text();
    throw new Error(`GitHub secret ${name} (${putRes.status}): ${body}`);
  }
}

async function getVercelProject(token) {
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(VERCEL_PROJECT)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel project (${res.status}): ${body}`);
  }
  return res.json();
}

async function listVercelEnv(projectId, teamId, token) {
  const qs = teamId ? `?teamId=${teamId}` : '';
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/env${qs}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel list env (${res.status}): ${body}`);
  }
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.envs)) return data.envs;
  throw new Error('Vercel list env: respuesta inesperada');
}

async function deleteVercelEnv(projectId, envId, teamId, token) {
  const qs = teamId ? `?teamId=${teamId}` : '';
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/env/${envId}${qs}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Vercel delete env (${res.status}): ${body}`);
  }
}

async function createVercelEnv(projectId, key, value, teamId, token) {
  const qs = teamId ? `?teamId=${teamId}` : '';
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/env${qs}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        value,
        type: 'encrypted',
        target: ['production', 'preview'],
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel create ${key} (${res.status}): ${body}`);
  }
}

async function upsertVercelEnv(project, key, value, token) {
  const projectId = project.id;
  const teamId = project.accountId && project.accountId !== project.id ? project.accountId : '';
  const envs = await listVercelEnv(projectId, teamId, token);
  for (const row of envs.filter((e) => e.key === key)) {
    await deleteVercelEnv(projectId, row.id, teamId, token);
  }
  await createVercelEnv(projectId, key, value, teamId, token);
}

function normalizeSupabaseUrl(url) {
  let u = url.trim().replace(/\/+$/, '');
  u = u.replace(/\/rest\/v1\/?$/i, '');
  if (u.startsWith('hhttps://')) u = u.replace(/^hhttps:\/\//, 'https://');
  return u;
}

async function main() {
  const skipGithub = process.argv.includes('--skip-github');
  const skipVercel = process.argv.includes('--skip-vercel');

  const githubToken = process.env.GITHUB_TOKEN?.trim();
  const vercelToken = process.env.VERCEL_TOKEN?.trim();
  if (!skipGithub && !githubToken) throw new Error('Falta GITHUB_TOKEN en .env');
  if (!skipVercel && !vercelToken) throw new Error('Falta VERCEL_TOKEN en .env');

  const values = {};
  for (const key of SYNC_KEYS) {
    let v = process.env[key]?.trim();
    if (!v) throw new Error(`Falta ${key} en .env`);
    if (key === 'SUPABASE_URL') v = normalizeSupabaseUrl(v);
    values[key] = v;
  }

  if (!skipGithub) {
    console.log('→ GitHub Actions secrets…');
    for (const key of SYNC_KEYS) {
      await setGithubSecret(key, values[key], githubToken);
      console.log(`   ✓ ${key}`);
    }
  }

  if (!skipVercel) {
    console.log('→ Vercel environment variables…');
    const project = await getVercelProject(vercelToken);
    for (const key of SYNC_KEYS) {
      await upsertVercelEnv(project, key, values[key], vercelToken);
      console.log(`   ✓ ${key}`);
    }
    for (const key of VERCEL_DASHBOARD_KEYS) {
      const v = process.env[key]?.trim();
      if (!v) {
        console.log(`   ⏭️  ${key} (no está en .env)`);
        continue;
      }
      await upsertVercelEnv(project, key, v, vercelToken);
      console.log(`   ✓ ${key}`);
    }
  }

  console.log('');
  console.log('✅ Listo. Siguiente:');
  console.log('   1. Vercel → Deployments → Redeploy (panel-editorial)');
  console.log('   2. GitHub → Actions → Pipeline emails → Run workflow');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
