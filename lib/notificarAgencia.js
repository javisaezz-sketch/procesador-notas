import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

function createSupabaseClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  return createClient(process.env.SUPABASE_URL, key);
}

const SAEZ_URL = 'https://saeznaves.com';

const MEDIOS_AVISO = {
  vidaystyle: {
    nombre: 'Vida&Style Magazine',
    fromName: 'Vida&Style Magazine',
    web: 'https://vidaystyle.com',
    replyTo: 'hola@vidaystyle.com',
    frase: 'Vida&Style Magazine ha publicado tu nota',
    logo: 'https://vidaystyle.com/wp-content/uploads/2020/04/cropped-logo-vs-pequeno-cuadrado.jpg',
  },
  femnegoci: {
    nombre: 'Fem Negoci',
    fromName: 'Fem Negoci',
    web: 'https://femnegoci.es',
    replyTo: 'hola@femnegoci.es',
    frase: 'Fem Negoci ha publicado tu nota',
    logo: 'https://femnegoci.es/wp-content/uploads/2025/10/cropped-logowebfemnegoci.jpg',
  },
  glamcloset: {
    nombre: 'Glamcloset',
    fromName: 'Glamcloset',
    web: 'https://glamcloset.cat',
    replyTo: 'hola@glamcloset.cat',
    frase: 'Glamcloset ha publicado tu nota',
    logo: 'https://glamcloset.cat/wp-content/uploads/2025/04/GLAMCLOSET_LOGOg-150x150-1.webp',
  },
  travelicius: {
    nombre: 'Travelicius',
    fromName: 'Travelicius',
    web: 'https://travelicius.es',
    replyTo: 'hola@travelicius.es',
    frase: 'Travelicius ha publicado tu nota',
    logo: 'https://travelicius.es/wp-content/uploads/2025/11/traveliciuslogo_blanco_p.webp',
    logoFondo: '#1c1917',
  },
  laglam: {
    nombre: 'La Glam del Buen Vivir',
    fromName: 'La Glam del Buen Vivir',
    web: 'https://www.instagram.com/laglamdelbuenvivir',
    frase: 'La Glam del Buen Vivir ha publicado tu nota en Instagram',
  },
};

const LOGOS_GRUPO = ['vidaystyle', 'femnegoci', 'glamcloset', 'travelicius'];

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

function logoPequeno(medio, { alto = 36 } = {}) {
  const img = `<img src="${escaparHtml(medio.logo)}" alt="${escaparHtml(medio.nombre)}" height="${alto}" style="display:block;height:${alto}px;width:auto;max-width:88px;border:0;outline:none;" />`;
  const caja = medio.logoFondo
    ? `<span style="display:inline-block;background:${medio.logoFondo};padding:6px 8px;border-radius:8px;line-height:0;">${img}</span>`
    : img;
  return `<a href="${escaparHtml(medio.web)}" style="display:inline-block;margin:0 8px 0 0;text-decoration:none;line-height:0;">${caja}</a>`;
}

function enlaceSaez(color = '#1c1917') {
  return `<a href="${SAEZ_URL}" style="color:${color};text-decoration:underline;">Sáez &amp; Naves Media Group</a>`;
}

export function construirAvisoMedio(slug, { titulo, enlace }) {
  const medio = MEDIOS_AVISO[slug];
  if (!medio) return null;

  const tituloLimpio = String(titulo || 'tu nota').trim();
  const asunto = medio.frase;

  if (slug === 'laglam') {
    const intro = 'Ya está en el feed. La Glam del Buen Vivir ha publicado tu nota en Instagram, con ese punto de buen vivir que no cabe en un bolsillo.';
    const cierre = 'Si te gusta, guárdala. Si te representa, pásasela a quien sepa apreciarla.';
    const marcas = LOGOS_GRUPO.map((id) => MEDIOS_AVISO[id]);
    const texto = [
      'Hola,',
      '',
      intro,
      '',
      tituloLimpio,
      enlace,
      '',
      cierre,
      '',
      'Un saludo con estilo,',
      'La Glam del Buen Vivir',
      ...marcas.map((marca) => `${marca.nombre}: ${marca.web}`),
      `Sáez & Naves Media Group: ${SAEZ_URL}`,
    ].join('\n');
    const html = `
      <div style="font-family:Georgia, 'Times New Roman', serif; color:#1c1917; line-height:1.55; max-width:520px;">
        <p style="margin:0 0 16px; font-size:16px;">Hola,</p>
        <p style="margin:0 0 16px; font-size:16px;">${escaparHtml(intro)}</p>
        <p style="margin:0 0 8px; font-size:16px; font-weight:bold;">${escaparHtml(tituloLimpio)}</p>
        <p style="margin:0 0 16px;">
          <a href="${escaparHtml(enlace)}" style="color:#9f1239; font-size:16px;">${escaparHtml(enlace)}</a>
        </p>
        <p style="margin:0 0 20px; font-size:16px;">${escaparHtml(cierre)}</p>
        <p style="margin:0 0 8px; font-size:14px; color:#78716c;">Un saludo con estilo,</p>
        <p style="margin:0 0 12px; font-size:0; line-height:0;">${marcas.map((marca) => logoPequeno(marca)).join('')}</p>
        <p style="margin:0 0 6px; font-size:13px;">
          ${marcas.map((marca) => `<a href="${escaparHtml(marca.web)}" style="color:#1c1917;text-decoration:underline;margin-right:10px;">${escaparHtml(marca.nombre)}</a>`).join('')}
        </p>
        <p style="margin:0; font-size:13px;">${enlaceSaez()}</p>
      </div>
    `.trim();
    return { asunto, texto, html, fromName: medio.fromName, replyTo: null };
  }

  const texto = [
    'Hola,',
    '',
    `${medio.frase}:`,
    '',
    tituloLimpio,
    enlace,
    '',
    `Sáez & Naves Media Group: ${SAEZ_URL}`,
    '',
    'Un saludo,',
    medio.nombre,
    medio.web,
  ].join('\n');
  const html = `
    <div style="font-family:Georgia, 'Times New Roman', serif; color:#1c1917; line-height:1.55; max-width:520px;">
      <p style="margin:0 0 16px; font-size:16px;">Hola,</p>
      <p style="margin:0 0 8px; font-size:18px;">${escaparHtml(medio.frase)}:</p>
      <p style="margin:0 0 8px; font-size:16px; font-weight:bold;">${escaparHtml(tituloLimpio)}</p>
      <p style="margin:0 0 18px;">
        <a href="${escaparHtml(enlace)}" style="color:#1c1917; font-size:16px;">${escaparHtml(enlace)}</a>
      </p>
      <p style="margin:0 0 18px; font-size:14px;">${enlaceSaez()}</p>
      <p style="margin:0 0 8px; font-size:14px; color:#78716c;">Un saludo,</p>
      <p style="margin:0; font-size:0; line-height:0;">${logoPequeno(medio, { alto: 42 })}</p>
    </div>
  `.trim();

  return { asunto, texto, html, fromName: medio.fromName, replyTo: medio.replyTo };
}

export async function enviarAvisoPublicacion({ slug, email, titulo, enlace }) {
  const destino = String(email || '').trim().toLowerCase();
  if (!esEmailAgencia(destino)) {
    return { enviado: false, omitido: true, motivo: 'sin_email' };
  }
  if (!enlace) {
    return { enviado: false, omitido: true, motivo: 'sin_enlace' };
  }

  const aviso = construirAvisoMedio(slug, { titulo, enlace });
  if (!aviso) {
    return { enviado: false, omitido: true, motivo: 'sin_plantilla' };
  }

  const supabase = createSupabaseClient();
  const { data: medio, error } = await supabase
    .from('medios')
    .select('email_pop_user, email_pop_password, email_pop_host')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !medio?.email_pop_user || !medio?.email_pop_password) {
    return {
      enviado: false,
      email: destino,
      error: 'El medio no tiene buzón configurado para enviar el aviso.',
    };
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
    socketTimeout: 20000,
  });

  try {
    await transporter.sendMail({
      from: `"${aviso.fromName}" <${medio.email_pop_user}>`,
      to: destino,
      subject: aviso.asunto,
      text: aviso.texto,
      html: aviso.html,
      ...(aviso.replyTo ? { replyTo: aviso.replyTo } : {}),
    });
    return { enviado: true, email: destino, replyTo: aviso.replyTo || medio.email_pop_user };
  } catch (smtpError) {
    return { enviado: false, email: destino, error: mensajeSinClaves(smtpError) };
  }
}

export function enviarAvisoPublicacionLaGlam(datos) {
  return enviarAvisoPublicacion({ ...datos, slug: 'laglam' });
}
