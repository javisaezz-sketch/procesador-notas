import nodemailer from 'nodemailer';
import { createSupabaseClient } from './supabase';

function escaparHtml(valor) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function esEmailAgencia(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function hostSmtp(popHost) {
  const host = String(popHost || '').trim().toLowerCase();
  if (host.startsWith('pop3.')) return `smtp.${host.slice(5)}`;
  if (host.startsWith('pop.')) return `smtp.${host.slice(4)}`;
  if (host.startsWith('imap.')) return `smtp.${host.slice(5)}`;
  return host || 'smtp.servidor-correo.net';
}

function mensajeSinClaves(error) {
  return String(error?.message || 'No se pudo enviar el aviso')
    .replace(/pass(word)?[=:]\s*\S+/gi, 'password')
    .slice(0, 240);
}

export async function enviarAvisoPublicacionLaGlam({ email, titulo, enlace }) {
  const destino = String(email || '').trim().toLowerCase();
  if (!esEmailAgencia(destino)) {
    return { enviado: false, omitido: true, motivo: 'sin_email' };
  }
  if (!enlace) {
    return { enviado: false, omitido: true, motivo: 'sin_enlace' };
  }

  const supabase = createSupabaseClient();
  const { data: medio, error } = await supabase
    .from('medios')
    .select('email_pop_user, email_pop_password, email_pop_host, nombre')
    .eq('slug', 'laglam')
    .maybeSingle();

  if (error || !medio?.email_pop_user || !medio?.email_pop_password) {
    return {
      enviado: false,
      email: destino,
      error: 'LaGlam no tiene buzón configurado para enviar el aviso.',
    };
  }

  const asunto = 'La Glam del Buen Vivir ha publicado tu nota';
  const tituloLimpio = String(titulo || 'tu nota').trim();
  const texto = [
    'Hola,',
    '',
    'La Glam del Buen Vivir ha publicado esta nota:',
    '',
    tituloLimpio,
    enlace,
    '',
    'La Glam del Buen Vivir es un perfil profesional de Sáez & Naves Media Group.',
    'En la publicación, los enlaces y los logos quedan enlazados.',
    '',
    'Un saludo,',
    'La Glam del Buen Vivir',
    '@laglamdelbuenvivir',
  ].join('\n');
  const html = `
    <div style="font-family:Georgia, 'Times New Roman', serif; color:#1c1917; line-height:1.5; max-width:520px;">
      <p style="margin:0 0 16px; font-size:16px;">Hola,</p>
      <p style="margin:0 0 8px; font-size:18px;">La Glam del Buen Vivir ha publicado esta nota:</p>
      <p style="margin:0 0 16px; font-size:16px; font-weight:bold;">${escaparHtml(tituloLimpio)}</p>
      <p style="margin:0 0 20px;">
        <a href="${escaparHtml(enlace)}" style="color:#9f1239; font-size:16px;">${escaparHtml(enlace)}</a>
      </p>
      <p style="margin:0 0 8px; font-size:14px; color:#44403c;">
        La Glam del Buen Vivir es un perfil profesional de Sáez &amp; Naves Media Group.
        En la publicación, los enlaces y los logos quedan enlazados.
      </p>
      <p style="margin:20px 0 0; font-size:14px; color:#78716c;">
        La Glam del Buen Vivir<br>@laglamdelbuenvivir
      </p>
    </div>
  `.trim();

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
    socketTimeout: 20000,
  });

  try {
    await transporter.sendMail({
      from: `"La Glam del Buen Vivir" <${medio.email_pop_user}>`,
      to: destino,
      subject: asunto,
      text: texto,
      html,
    });
    return { enviado: true, email: destino };
  } catch (smtpError) {
    return { enviado: false, email: destino, error: mensajeSinClaves(smtpError) };
  }
}
