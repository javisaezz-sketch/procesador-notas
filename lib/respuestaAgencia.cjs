const nodemailer = require('nodemailer');

const DESTINO_RESPUESTA = 'noenavessl@gmail.com';
const FRASE_AVISO = /ha publicado tu nota/i;

function esRespuestaAvisoPublicacion(parsed) {
  return FRASE_AVISO.test(String(parsed?.subject || ''));
}

function direccionDe(parsed) {
  return String(parsed?.from?.value?.[0]?.address || '').trim().toLowerCase();
}

function decidirCorreoEntrante(parsed) {
  if (!esRespuestaAvisoPublicacion(parsed)) return 'procesar';
  if (direccionDe(parsed) === DESTINO_RESPUESTA) return 'borrar';
  return 'reenviar';
}

function hostSmtp(popHost) {
  const host = String(popHost || '').trim().toLowerCase();
  if (host.startsWith('pop3.')) return `smtp.${host.slice(5)}`;
  if (host.startsWith('pop.')) return `smtp.${host.slice(4)}`;
  if (host.startsWith('imap.')) return `smtp.${host.slice(5)}`;
  return host || 'smtp.servidor-correo.net';
}

function mensajeSinClaves(error) {
  return String(error?.message || 'No se pudo reenviar la respuesta')
    .replace(/pass(word)?[=:]\s*\S+/gi, 'password')
    .slice(0, 240);
}

function textoRemitente(parsed) {
  const from = parsed?.from?.value?.[0];
  if (!from) return 'desconocido';
  if (from.name && from.address) return `${from.name} <${from.address}>`;
  return from.address || from.name || 'desconocido';
}

function textoPlano(parsed) {
  const texto = String(parsed?.text || '').trim();
  if (texto) return texto.slice(0, 80000);
  return String(parsed?.html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80000);
}

async function reenviarRespuestaAgencia({ medio, parsed }) {
  const desde = direccionDe(parsed);
  if (!desde || desde === DESTINO_RESPUESTA) {
    return { enviado: false, omitido: true, motivo: 'propia' };
  }
  if (desde === String(medio?.email_pop_user || '').trim().toLowerCase()) {
    return { enviado: false, omitido: true, motivo: 'buzon' };
  }

  const transporter = nodemailer.createTransport({
    host: hostSmtp(medio.email_pop_host),
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: medio.email_pop_user,
      pass: medio.email_pop_password,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  const asuntoOriginal = String(parsed.subject || '(sin asunto)').trim();
  const cuando = parsed.date instanceof Date && !Number.isNaN(parsed.date.getTime())
    ? new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Madrid',
    }).format(parsed.date)
    : '';
  const cuerpo = textoPlano(parsed) || '(sin texto)';
  const intro = [
    `Respuesta recibida en ${medio.email_pop_user}. No entra en el panel.`,
    '',
    `De: ${textoRemitente(parsed)}`,
    `Asunto: ${asuntoOriginal}`,
    cuando ? `Fecha: ${cuando}` : null,
    '',
    '----- Mensaje -----',
    '',
    cuerpo,
  ].filter((linea) => linea !== null).join('\n');

  const adjuntos = (parsed.attachments || [])
    .filter((adjunto) => adjunto?.content)
    .slice(0, 15)
    .map((adjunto) => ({
      filename: adjunto.filename || 'adjunto',
      content: adjunto.content,
      contentType: adjunto.contentType,
      ...(adjunto.cid ? { cid: adjunto.cid } : {}),
    }));

  try {
    await transporter.sendMail({
      from: `"${medio.nombre || 'Panel editorial'}" <${medio.email_pop_user}>`,
      to: DESTINO_RESPUESTA,
      replyTo: desde,
      subject: /^fwd:/i.test(asuntoOriginal) ? asuntoOriginal : `Fwd: ${asuntoOriginal}`,
      text: intro,
      ...(adjuntos.length ? { attachments: adjuntos } : {}),
    });
    return { enviado: true, email: DESTINO_RESPUESTA };
  } catch (error) {
    return { enviado: false, error: mensajeSinClaves(error) };
  }
}

module.exports = {
  DESTINO_RESPUESTA,
  esRespuestaAvisoPublicacion,
  decidirCorreoEntrante,
  reenviarRespuestaAgencia,
};
