/**
 * Redeploy production en Vercel (carga env vars nuevas).
 * Requiere VERCEL_TOKEN en .env
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const VERCEL_PROJECT = process.env.VERCEL_PROJECT || 'panel-editorial';

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) throw new Error('Falta VERCEL_TOKEN en .env');

  const projectRes = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(VERCEL_PROJECT)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!projectRes.ok) {
    throw new Error(`Proyecto (${projectRes.status}): ${await projectRes.text()}`);
  }
  const project = await projectRes.json();
  const teamId = project.accountId;
  const teamQs = teamId ? `&teamId=${teamId}` : '';

  const listRes = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${project.id}&limit=1${teamQs}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!listRes.ok) {
    throw new Error(`List deployments (${listRes.status}): ${await listRes.text()}`);
  }
  const { deployments } = await listRes.json();
  const latest = deployments?.[0];
  if (!latest?.uid) throw new Error('No hay deployments previos');

  const redeployRes = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: project.name,
      deploymentId: latest.uid,
      target: 'production',
    }),
  });
  const body = await redeployRes.json();
  if (!redeployRes.ok) {
    throw new Error(`Redeploy (${redeployRes.status}): ${JSON.stringify(body)}`);
  }

  console.log(`✅ Redeploy iniciado: ${body.url ?? body.id ?? latest.url}`);
  console.log('   Espera 1–2 min y recarga el panel.');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
