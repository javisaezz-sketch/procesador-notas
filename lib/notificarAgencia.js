import path from 'path';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const FUENTE = "Georgia, 'Times New Roman', serif";
const LOGOS_DIR = path.join(process.cwd(), 'lib', 'logos-aviso');

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
    logo: 'vidaystyle.png',
    ancho: 72,
    alto: 72,
    nombreCorto: 'Vida&Style',
  },
  femnegoci: {
    nombre: 'Fem Negoci',
    fromName: 'Fem Negoci',
    web: 'https://femnegoci.es',
    replyTo: 'hola@femnegoci.es',
    frase: 'Fem Negoci ha publicado tu nota',
    logo: 'femnegoci.png',
    ancho: 112,
    alto: 37,
    nombreCorto: 'Fem Negoci',
  },
  glamcloset: {
    nombre: 'Glamcloset',
    fromName: 'Glamcloset',
    web: 'https://glamcloset.cat',
    replyTo: 'hola@glamcloset.cat',
    frase: 'Glamcloset ha publicado tu nota',
    logo: 'glamcloset.png',
    ancho: 72,
    alto: 72,
    nombreCorto: 'Glamcloset',
  },
  travelicius: {
    nombre: 'Travelicius',
    fromName: 'Travelicius',
    web: 'https://travelicius.es',
    replyTo: 'hola@travelicius.es',
    frase: 'Travelicius ha publicado tu nota',
    logo: 'travelicius.png',
    ancho: 118,
    alto: 25,
    nombreCorto: 'Travelicius',
  },
  laglam: {
    nombre: 'La Glam del Buen Vivir',
    fromName: 'La Glam del Buen Vivir',
    web: 'https://www.instagram.com/laglamdelbuenvivir',
    frase: 'La Glam del Buen Vivir ha publicado tu nota en Instagram',
    logo: 'laglam.png',
    ancho: 88,
    alto: 88,
    nombreCorto: 'La Glam del Buen Vivir',
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
  return `<a href="${SAEZ_URL}" style="font-family:${FUENTE}; font-size:14px; color:${color}; text-decoration:underline;">Sáez &amp; Naves Media Group</a>`;
}

function celdaMarca(marca) {
  return `
    <td align="center" valign="bottom" width="25%" style="padding:8px 4px 2px; font-family:${FUENTE}; font-size:13px; color:#1c1917; line-height:1.35;">
      <a href="${escaparHtml(marca.web)}" style="text-decoration:none;">
        <img src="cid:logo-${escaparHtml(marca.id)}" alt="${escaparHtml(marca.nombreCorto)}" width="${marca.ancho}" height="${marca.alto}" style="display:block; margin:0 auto 10px; border:0; outline:none; width:${marca.ancho}px; height:${marca.alto}px;" />
      </a>
      <a href="${escaparHtml(marca.web)}" style="font-family:${FUENTE}; font-size:14px; color:#1c1917; text-decoration:underline;">${escaparHtml(marca.nombreCorto)}</a>
    </td>
  `.trim();
}

export function construirAvisoMedio(slug, { titulo, enlace }) {
  const medio = MEDIOS_AVISO[slug];
  if (!medio) return null;

  const tituloLimpio = String(titulo || 'tu nota').trim();
  const asunto = medio.frase;

  if (slug === 'laglam') {
    const intro = 'Ya está en el feed. La Glam del Buen Vivir ha publicado tu nota en Instagram, con ese punto de buen vivir que no cabe en un bolsillo.';
    const cierre = 'Si te gusta, guárdala. Si te representa, pásasela a quien sepa apreciarla.';
    const marcas = LOGOS_GRUPO.map((id) => ({ id, ...MEDIOS_AVISO[id] }));
    const firma = { id: 'laglam', ...MEDIOS_AVISO.laglam };
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
      `${firma.nombreCorto}: ${firma.web}`,
      ...marcas.map((marca) => `${marca.nombreCorto}: ${marca.web}`),
      `Sáez & Naves Media Group: ${SAEZ_URL}`,
    ].join('\n');
    const html = `
      <div style="font-family:${FUENTE}; color:#1c1917; line-height:1.55; max-width:560px;">
        <p style="margin:0 0 16px; font-family:${FUENTE}; font-size:16px;">Hola,</p>
        <p style="margin:0 0 16px; font-family:${FUENTE}; font-size:16px;">${escaparHtml(intro)}</p>
        <p style="margin:0 0 8px; font-family:${FUENTE}; font-size:16px; font-weight:bold;">${escaparHtml(tituloLimpio)}</p>
        <p style="margin:0 0 16px; font-family:${FUENTE}; font-size:16px;">
          <a href="${escaparHtml(enlace)}" style="font-family:${FUENTE}; color:#9f1239; font-size:16px;">${escaparHtml(enlace)}</a>
        </p>
        <p style="margin:0 0 20px; font-family:${FUENTE}; font-size:16px;">${escaparHtml(cierre)}</p>
        <p style="margin:0 0 12px; font-family:${FUENTE}; font-size:14px; color:#78716c;">Un saludo con estilo,</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse; font-family:${FUENTE}; font-size:14px; color:#1c1917;">
          <tr>
            <td align="center" style="padding:0 8px 14px; font-family:${FUENTE}; font-size:14px; color:#1c1917; line-height:1.35;">
              <a href="${escaparHtml(firma.web)}" style="text-decoration:none;">
                <img src="cid:logo-laglam" alt="${escaparHtml(firma.nombreCorto)}" width="${firma.ancho}" height="${firma.alto}" style="display:block; margin:0 auto 10px; border:0; outline:none; width:${firma.ancho}px; height:${firma.alto}px;" />
              </a>
              <a href="${escaparHtml(firma.web)}" style="font-family:${FUENTE}; font-size:14px; color:#1c1917; text-decoration:underline;">${escaparHtml(firma.nombreCorto)}</a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse; font-family:${FUENTE}; font-size:14px; color:#1c1917;">
          <tr>
            ${marcas.map((marca) => celdaMarca(marca)).join('')}
          </tr>
          <tr>
            <td colspan="4" align="center" style="padding:14px 8px 0; font-family:${FUENTE}; font-size:14px; color:#1c1917;">
              ${enlaceSaez()}
            </td>
          </tr>
        </table>
      </div>
    `.trim();
    return {
      asunto,
      texto,
      html,
      fromName: medio.fromName,
      replyTo: null,
      adjuntos: [firma, ...marcas].map((marca) => ({
        filename: marca.logo,
        path: path.join(LOGOS_DIR, marca.logo),
        cid: `logo-${marca.id}`,
      })),
    };
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

export async function enviarAvisoPublicacion({ slug, email, titulo, enlace, copia }) {
  if (slug !== 'laglam') {
    return { enviado: false, omitido: true, motivo: 'wordpress' };
  }

  const destino = String(email || '').trim().toLowerCase();
  const copias = String(copia || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => esEmailAgencia(item) && item !== destino);
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
      ...(copias.length ? { cc: copias.join(', ') } : {}),
      subject: aviso.asunto,
      text: aviso.texto,
      html: aviso.html,
      ...(aviso.replyTo ? { replyTo: aviso.replyTo } : {}),
      ...(aviso.adjuntos?.length ? { attachments: aviso.adjuntos } : {}),
    });
    return {
      enviado: true,
      email: destino,
      copia: copias,
      replyTo: aviso.replyTo || medio.email_pop_user,
    };
  } catch (smtpError) {
    return { enviado: false, email: destino, error: mensajeSinClaves(smtpError) };
  }
}

export function enviarAvisoPublicacionLaGlam(datos) {
  return enviarAvisoPublicacion({ ...datos, slug: 'laglam' });
}
