const Pop3Command = require('node-pop3');

function crearClientePop3(medio) {
  return new Pop3Command({
    user: medio.email_pop_user,
    password: medio.email_pop_password,
    host: medio.email_pop_host,
    port: Number(medio.email_pop_port || 110),
    tls: medio.email_pop_secure === true || medio.email_pop_secure === 'true',
  });
}

function normalizarMessageId(messageId) {
  return String(messageId).trim().toLowerCase().replace(/^<|>$/g, '');
}

function extraerMessageIdDeHeaders(headers) {
  const lineas = String(headers || '').split(/\r?\n/);
  let actual = '';

  for (const linea of lineas) {
    if (/^\s/.test(linea) && actual) {
      actual += ` ${linea.trim()}`;
      continue;
    }

    if (actual) {
      const match = actual.match(/^Message-ID:\s*(.+)$/i);
      if (match) return match[1].trim();
    }

    actual = linea.trim();
  }

  if (actual) {
    const match = actual.match(/^Message-ID:\s*(.+)$/i);
    if (match) return match[1].trim();
  }

  return null;
}

async function obtenerHeadersMensaje(client, numero) {
  try {
    return await client.TOP(numero, 0);
  } catch {
    const raw = await client.RETR(numero);
    return raw.split(/\r?\n\r?\n/)[0] || raw.slice(0, 4096);
  }
}

async function buscarNumeroPorMessageId(client, messageId) {
  const objetivo = normalizarMessageId(messageId);
  const listado = await client.LIST();

  if (!listado?.length) {
    return null;
  }

  for (const item of listado) {
    const numero = item[0];
    const headers = await obtenerHeadersMensaje(client, numero);
    const encontrado = extraerMessageIdDeHeaders(headers);

    if (encontrado && normalizarMessageId(encontrado) === objetivo) {
      return numero;
    }
  }

  return null;
}

async function eliminarEmailPorMessageId(medio, messageId) {
  if (!messageId?.trim()) {
    return { eliminado: false, motivo: 'sin_message_id' };
  }

  if (!medio?.email_pop_host || !medio?.email_pop_user || !medio?.email_pop_password) {
    return { eliminado: false, motivo: 'sin_buzon_configurado' };
  }

  const client = crearClientePop3(medio);

  try {
    const numero = await buscarNumeroPorMessageId(client, messageId);

    if (!numero) {
      return { eliminado: false, motivo: 'no_encontrado_en_buzon' };
    }

    await client.DELE(numero);
    await client.QUIT();

    return { eliminado: true, numero };
  } catch (error) {
    try {
      await client.QUIT();
    } catch {
      // ignorar error al cerrar
    }

    throw error;
  }
}

module.exports = {
  eliminarEmailPorMessageId,
};
