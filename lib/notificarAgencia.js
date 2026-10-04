import nodemailer from 'nodemailer';
import { createSupabaseClient } from './supabase';

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

  const asunto = 'Tu nota ya está publicada en LaGlam';
  const tituloLimpio = String(titulo || '').trim();
  const texto = [
    'Hola,',
    '',
    'Hemos publicado tu contenido en Instagram, en @laglamdelbuenvivir.',
    tituloLimpio ? '' : null,
    tituloLimpio || null,
    '',
    'Puedes verlo aquí:',
    enlace,
    '',
    'Un saludo,',
    'LaGlam del Buen Vivir',
  ]
    .filter((linea) => linea !== null)
    .join('\n');

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
      from: `"LaGlam del Buen Vivir" <${medio.email_pop_user}>`,
      to: destino,
      subject: asunto,
      text: texto,
    });
    return { enviado: true, email: destino };
  } catch (smtpError) {
    return { enviado: false, email: destino, error: mensajeSinClaves(smtpError) };
  }
}
