const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'EMAIL_IMAP_HOST',
  'EMAIL_IMAP_USER',
  'EMAIL_IMAP_PASSWORD',
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }
}

async function procesarBandejaImap() {
  validateEnv();

  const { guardarNotaDesdeEmail, extraerImagenesDeMailparser } = await import(
    '../lib/ingestNota.js'
  );

  const client = new ImapFlow({
    host: process.env.EMAIL_IMAP_HOST,
    port: Number(process.env.EMAIL_IMAP_PORT || 993),
    secure: process.env.EMAIL_IMAP_SECURE !== 'false',
    auth: {
      user: process.env.EMAIL_IMAP_USER,
      pass: process.env.EMAIL_IMAP_PASSWORD,
    },
  });

  await client.connect();
  console.log('📬 Conectado al buzón IMAP');

  const mailbox = process.env.EMAIL_IMAP_MAILBOX || 'INBOX';
  const lock = await client.getMailboxLock(mailbox);

  try {
    const unseen = await client.search({ seen: false });

    if (!unseen.length) {
      console.log('No hay emails nuevos.');
      return;
    }

    for (const uid of unseen) {
      const message = await client.fetchOne(`${uid}`, {
        source: true,
        envelope: true,
      });

      const parsed = await simpleParser(message.source);
      const remitente =
        parsed.from?.value?.[0]?.address ||
        message.envelope?.from?.[0]?.address ||
        null;

      const resultado = await guardarNotaDesdeEmail({
        remitente,
        asunto: parsed.subject || message.envelope?.subject || 'Sin asunto',
        texto: parsed.text,
        html: parsed.html,
        imagenes: extraerImagenesDeMailparser(parsed),
        messageId: parsed.messageId,
      });

      if (!resultado.duplicado) {
        console.log('✅ Nota guardada en Supabase');
        console.log(`   ID: ${resultado.nota.id}`);
      }

      await client.messageFlagsAdd(`${uid}`, ['\\Seen']);
    }
  } finally {
    lock.release();
  }

  await client.logout();
}

module.exports = { procesarBandejaImap };
