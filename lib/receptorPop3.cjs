require('dotenv').config();

const { simpleParser } = require('mailparser');
const Pop3Command = require('node-pop3');
const { createSupabaseNodeClient } = require('./supabaseNode.cjs');

const REQUIRED_ENV_POP = [
  'SUPABASE_URL',
];

function validateEnvPop() {
  const missing = REQUIRED_ENV_POP.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }
}

function crearClientePop3(config) {
  return new Pop3Command({
    user: config.user,
    password: config.password,
    host: config.host,
    port: Number(config.port || 110),
    tls: config.secure === true || config.secure === 'true',
  });
}

async function obtenerMediosConEmail(supabase) {
  const { data: medios, error } = await supabase
    .from('medios')
    .select(
      'id, nombre, slug, email_pop_user, email_pop_password, email_pop_host, email_pop_port, email_pop_secure',
    )
    .not('email_pop_user', 'is', null)
    .order('id', { ascending: true });

  if (error) {
    throw new Error(`No se pudieron leer los medios: ${error.message}`);
  }

  return (medios ?? []).filter((medio) => medio.email_pop_password && medio.email_pop_host);
}

function obtenerMedioLegacyDesdeEnv() {
  if (!process.env.EMAIL_POP_USER || !process.env.EMAIL_POP_PASSWORD || !process.env.EMAIL_POP_HOST) {
    return null;
  }

  return {
    id: Number(process.env.MEDIO_ID || 1),
    nombre: 'Medio (.env)',
    slug: 'legacy',
    email_pop_user: process.env.EMAIL_POP_USER,
    email_pop_password: process.env.EMAIL_POP_PASSWORD,
    email_pop_host: process.env.EMAIL_POP_HOST,
    email_pop_port: process.env.EMAIL_POP_PORT || 110,
    email_pop_secure: process.env.EMAIL_POP_SECURE === 'true',
  };
}

async function procesarBandejaPop3Medio(medio, deps) {
  const { guardarNotaDesdeEmail, extraerImagenesDeMailparser } = deps;
  const stats = { medio: medio.nombre, nuevas: 0, duplicadas: 0, imagenes: 0 };

  const client = crearClientePop3({
    user: medio.email_pop_user,
    password: medio.email_pop_password,
    host: medio.email_pop_host,
    port: medio.email_pop_port,
    secure: medio.email_pop_secure,
  });

  console.log(`📬 ${medio.nombre} (${medio.email_pop_user})`);
  console.log(`   Host: ${medio.email_pop_host}:${medio.email_pop_port || 110}`);

  const listado = await client.LIST();

  if (!listado?.length) {
    console.log('   Sin emails en el buzón.');
    await client.QUIT();
    return stats;
  }

  console.log(`   ${listado.length} email(s) encontrado(s).`);

  for (const item of listado) {
    const numero = item[0];
    const raw = await client.RETR(numero);
    const parsed = await simpleParser(raw);

    const remitente = parsed.from?.value?.[0]?.address || null;
    const asunto = parsed.subject || 'Sin asunto';

    const { resolverEmailNotificacion } = await import('./extraerRemitenteEmail.js');
    const emailNotificacion = resolverEmailNotificacion(parsed);

    const resultado = await guardarNotaDesdeEmail({
      remitente: emailNotificacion || remitente,
      asunto,
      texto: parsed.text,
      html: parsed.html,
      imagenes: extraerImagenesDeMailparser(parsed),
      messageId: parsed.messageId,
      medioId: medio.id,
    });

    if (resultado.duplicado) {
      stats.duplicadas += 1;
      console.log(`   ⏭️  Ya procesado: ${asunto.slice(0, 50)}...`);
      continue;
    }

    stats.nuevas += 1;
    stats.imagenes += resultado.imagenes.length;
    const origen = resultado.urlLeida ? ` | URL: ${resultado.urlLeida}` : '';
    console.log(
      `   ✅ Nota #${resultado.nota.id} | Imágenes: ${resultado.imagenes.length}${origen}`,
    );

    if (process.env.EMAIL_POP_DELETE_AFTER === 'true') {
      await client.DELE(numero);
    }
  }

  await client.QUIT();
  return stats;
}

async function procesarBandejaPop3() {
  validateEnvPop();

  const { guardarNotaDesdeEmail, extraerImagenesDeMailparser } = await import('./ingestNota.js');
  const deps = { guardarNotaDesdeEmail, extraerImagenesDeMailparser };

  const supabase = createSupabaseNodeClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  );

  let medios = await obtenerMediosConEmail(supabase);

  if (!medios.length) {
    const legacy = obtenerMedioLegacyDesdeEnv();
    if (legacy) {
      medios = [legacy];
      console.log('   ℹ️  Usando buzón del .env (ningún medio tiene email en Supabase).');
    }
  }

  if (!medios.length) {
    throw new Error(
      'No hay buzones configurados. Añade email_pop_* en la tabla medios o variables EMAIL_POP_* en .env',
    );
  }

  console.log('📬 Conectando buzones POP3...');

  const resumen = {
    nuevas: 0,
    duplicadas: 0,
    imagenes: 0,
    medios: [],
  };

  for (const medio of medios) {
    try {
      const stats = await procesarBandejaPop3Medio(medio, deps);
      resumen.nuevas += stats.nuevas;
      resumen.duplicadas += stats.duplicadas;
      resumen.imagenes += stats.imagenes;
      resumen.medios.push(stats);
    } catch (error) {
      console.error(`   ❌ ${medio.nombre}: ${error.message}`);
      resumen.medios.push({
        medio: medio.nombre,
        nuevas: 0,
        duplicadas: 0,
        imagenes: 0,
        error: error.message,
      });
      resumen.errores = resumen.errores ?? [];
      resumen.errores.push({ medio: medio.nombre, error: error.message });
    }
  }

  return resumen;
}

module.exports = { procesarBandejaPop3 };
