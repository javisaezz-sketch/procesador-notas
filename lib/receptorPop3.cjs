require('dotenv').config();

const { simpleParser } = require('mailparser');
const Pop3Command = require('node-pop3');
const { createSupabaseNodeClient } = require('./supabaseNode.cjs');
const { decidirCorreoEntrante, reenviarRespuestaAgencia } = require('./respuestaAgencia.cjs');

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
    timeout: 30000,
  });
}

async function obtenerMediosConEmail(supabase) {
  let medios;
  let error;

  try {
    ({ data: medios, error } = await supabase
      .from('medios')
      .select(
        'id, nombre, slug, email_pop_user, email_pop_password, email_pop_host, email_pop_port, email_pop_secure',
      )
      .not('email_pop_user', 'is', null)
      .order('id', { ascending: true }));
  } catch (fetchError) {
    const causa = fetchError.cause?.code || fetchError.cause?.message || '';
    throw new Error(
      `No se pudieron leer los medios: ${fetchError.message}${causa ? ` (${causa})` : ''}. Comprueba SUPABASE_URL en GitHub Secrets (proyecto activo en supabase.com).`,
    );
  }

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
  const stats = {
    medio: medio.nombre,
    nuevas: 0,
    duplicadas: 0,
    duplicados: [],
    imagenes: 0,
    reenviadas: 0,
    reenviosFallidos: [],
  };

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

  const pendientes = [];
  let confirmarBorrados = false;

  try {
  for (const item of listado) {
    const numero = item[0];
    const bytes = item[1];
    const tamanoMb = bytes ? ` (${(Number(bytes) / (1024 * 1024)).toFixed(1)} MB)` : '';
    console.log(`   ⏳ Descargando email ${numero}/${listado.length}${tamanoMb}...`);
    const raw = await client.RETR(numero);
    const parsed = await simpleParser(raw);

    const remitente = parsed.from?.value?.[0]?.address || null;
    const asunto = parsed.subject || 'Sin asunto';
    const decision = decidirCorreoEntrante(parsed);

    if (decision !== 'procesar') {
      if (decision === 'reenviar') {
        const reenvio = await reenviarRespuestaAgencia({ medio, parsed });
        if (reenvio.omitido) {
          console.log(`   ↪️  Respuesta de ${remitente || 'desconocido'} quitada del buzón, sin procesar.`);
        } else if (!reenvio.enviado) {
          const detalle = reenvio.error || 'No se pudo reenviar';
          stats.reenviosFallidos.push({ remitente, asunto, error: detalle });
          console.error(`   ⚠️  Respuesta de ${remitente || 'desconocido'} sin reenviar: ${detalle}. Sigue en el buzón.`);
          continue;
        } else {
          console.log(`   ↪️  Respuesta de ${remitente} reenviada a Noe y quitada del buzón.`);
        }
      } else {
        console.log(`   ↪️  Respuesta de ${remitente || 'desconocido'} quitada del buzón, sin procesar.`);
      }

      await client.DELE(numero);
      stats.reenviadas += 1;
      continue;
    }

    const { resolverEmailNotificacion } = await import('./extraerRemitenteEmail.js');
    const { describirMotivoDuplicado } = await import('./detectarDuplicadoNota.js');
    const emailNotificacion = resolverEmailNotificacion(parsed);

    const resultado = await guardarNotaDesdeEmail({
      remitente: emailNotificacion || remitente,
      asunto,
      texto: parsed.text,
      html: parsed.html,
      imagenes: extraerImagenesDeMailparser(parsed),
      messageId: parsed.messageId,
      medioId: medio.id,
      enriquecer: false,
    });

    if (!resultado?.nota?.id) {
      console.error(`   ⚠️  ${asunto.slice(0, 60)} no se guardó. Sigue en el buzón.`);
      continue;
    }

    if (resultado.duplicado) {
      stats.duplicadas += 1;
      stats.duplicados.push({
        asunto: asunto.slice(0, 120),
        notaId: resultado.nota.id,
        motivo: describirMotivoDuplicado(resultado.motivoDuplicado),
      });
      const motivo = describirMotivoDuplicado(resultado.motivoDuplicado);
      console.log(
        `   ⏭️  Duplicado (${motivo}): ${asunto.slice(0, 50)}... → nota #${resultado.nota.id}`,
      );
    } else {
      stats.nuevas += 1;
      stats.imagenes += resultado.imagenes.length;
      pendientes.push(resultado.nota.id);
      console.log(
        `   ✅ Nota #${resultado.nota.id} | Imágenes: ${resultado.imagenes.length}`,
      );
    }

    // Solo se quita del buzón si la nota existe (nueva o ya guardada).
    // Pon EMAIL_POP_KEEP=true si quieres conservar copias en el servidor.
    if (process.env.EMAIL_POP_KEEP !== 'true') {
      await client.DELE(numero);
    }
  }

  confirmarBorrados = true;
  await client.QUIT();
  } catch (error) {
    if (!confirmarBorrados) {
      try {
        await client.RSET();
        await client.QUIT();
      } catch {
        try {
          client._socket?.destroy();
        } catch {
          // Sin QUIT el servidor conserva los correos.
        }
      }
    }
    await completarNotas();
    throw error;
  }

  await completarNotas();
  return stats;

  async function completarNotas() {
    if (!pendientes.length || !deps.enriquecerNotaGuardada) return;
    for (const notaId of pendientes) {
      try {
        const enriquecida = await deps.enriquecerNotaGuardada(notaId);
        if (enriquecida?.urlLeida) {
          console.log(`   🔗 Nota #${notaId} | URL: ${enriquecida.urlLeida}`);
        }
      } catch (fallo) {
        console.warn(`   ⚠️  Nota #${notaId} guardada, sin poder leer el enlace: ${fallo.message}`);
      }
    }
  }
}

async function procesarBandejaPop3() {
  validateEnvPop();

  const { guardarNotaDesdeEmail, extraerImagenesDeMailparser, enriquecerNotaGuardada } = await import('./ingestNota.js');
  const deps = { guardarNotaDesdeEmail, extraerImagenesDeMailparser, enriquecerNotaGuardada };

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
    reenviadas: 0,
    reenviosFallidos: [],
    medios: [],
  };

  for (const medio of medios) {
    try {
      const stats = await procesarBandejaPop3Medio(medio, deps);
      resumen.nuevas += stats.nuevas;
      resumen.duplicadas += stats.duplicadas;
      resumen.imagenes += stats.imagenes;
      resumen.reenviadas += stats.reenviadas || 0;
      resumen.reenviosFallidos.push(...(stats.reenviosFallidos || []));
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
