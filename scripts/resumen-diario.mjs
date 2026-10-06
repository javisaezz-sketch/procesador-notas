import 'dotenv/config';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const DESTINO = (process.env.RESUMEN_DIARIO_EMAIL || 'javisaezz@gmail.com').trim().toLowerCase();
const ZONA = 'Europe/Madrid';
const PANEL = 'https://panel-editorial.vercel.app';

const ESTADO_ARTICULO = {
  pendiente_revision: 'Pendiente de revisión',
  publicado: 'Publicado',
  programado: 'Programado',
  anulado: 'Anulado',
};

function horaMadrid(ahora = new Date()) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: ZONA,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(ahora),
  );
}

function partesMadrid(ahora) {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora);
  return Object.fromEntries(partes.filter((parte) => parte.type !== 'literal').map((parte) => [parte.type, parte.value]));
}

function inicioDiaMadrid(ahora = new Date()) {
  const { year, month, day } = partesMadrid(ahora);
  const dia = `${year}-${month}-${day}`;
  const probe = new Date(`${dia}T12:00:00Z`);
  const offset = Number(partesMadrid(probe).hour) - 12;
  const inicio = new Date(`${dia}T00:00:00Z`);
  inicio.setUTCHours(inicio.getUTCHours() - offset);
  return inicio;
}

function fechaLarga(ahora) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: ZONA,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(ahora);
}

function horaCorta(iso) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function escapar(valor) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hostSmtp(popHost) {
  const host = String(popHost || '').trim().toLowerCase();
  if (host.startsWith('pop3.')) return `smtp.${host.slice(5)}`;
  if (host.startsWith('pop.')) return `smtp.${host.slice(4)}`;
  if (host.startsWith('imap.')) return `smtp.${host.slice(5)}`;
  return host || 'smtp.servidor-correo.net';
}

function estadoNota(nota, articulos) {
  if (nota.estado === 'error_procesamiento') return 'En Errores IA';
  if (nota.estado === 'recibida' || nota.estado === 'procesando') return 'En cola, aún sin artículo';
  if (nota.estado === 'descartada') return 'Descartada';
  if (!articulos.length) return 'Procesada, sin artículo';
  return null;
}

function avisoNota(nota) {
  const texto = String(nota.error_mensaje || '').trim();
  if (!texto || texto.startsWith('procesando_desde:')) return '';
  return texto.replace(/\s+/g, ' ').slice(0, 220);
}

function fotosTexto(cantidad) {
  if (!cantidad) return 'sin fotos';
  return cantidad === 1 ? '1 foto' : `${cantidad} fotos`;
}

async function cargarDia(supabase, desde, hasta) {
  const { data: medios, error: errorMedios } = await supabase
    .from('medios')
    .select('id, nombre, slug')
    .order('id', { ascending: true });
  if (errorMedios) throw new Error(errorMedios.message);

  const { data: notas, error: errorNotas } = await supabase
    .from('notas_prensa')
    .select('id, medio_id, asunto, estado, error_mensaje, fecha_recepcion, remitente')
    .gte('fecha_recepcion', desde)
    .lt('fecha_recepcion', hasta)
    .order('fecha_recepcion', { ascending: true })
    .limit(300);
  if (errorNotas) throw new Error(errorNotas.message);

  const ids = (notas || []).map((nota) => nota.id);
  let articulos = [];
  let imagenes = [];
  if (ids.length) {
    const arts = await supabase
      .from('articulos')
      .select('id, estado, titulo_generado, nota_prensa_id')
      .in('nota_prensa_id', ids);
    if (arts.error) throw new Error(arts.error.message);
    articulos = arts.data || [];

    const imgs = await supabase
      .from('notas_prensa_imagenes')
      .select('nota_prensa_id')
      .in('nota_prensa_id', ids);
    if (imgs.error) throw new Error(imgs.error.message);
    imagenes = imgs.data || [];
  }

  const artsPorNota = new Map();
  for (const articulo of articulos) {
    const lista = artsPorNota.get(articulo.nota_prensa_id) || [];
    lista.push(articulo);
    artsPorNota.set(articulo.nota_prensa_id, lista);
  }
  const fotosPorNota = new Map();
  for (const imagen of imagenes) {
    fotosPorNota.set(imagen.nota_prensa_id, (fotosPorNota.get(imagen.nota_prensa_id) || 0) + 1);
  }

  const porMedio = new Map((medios || []).map((medio) => [medio.id, []]));
  for (const nota of notas || []) {
    const lista = porMedio.get(nota.medio_id) || [];
    lista.push({
      ...nota,
      articulos: artsPorNota.get(nota.id) || [],
      fotos: fotosPorNota.get(nota.id) || 0,
    });
    porMedio.set(nota.medio_id, lista);
  }

  return { medios: medios || [], porMedio, total: (notas || []).length };
}

function lineaArticulo(articulo) {
  const estado = ESTADO_ARTICULO[articulo.estado] || articulo.estado || 'Sin estado';
  const titulo = String(articulo.titulo_generado || '').replace(/\s+/g, ' ').trim();
  return {
    estado,
    titulo,
    texto: `Artículo #${articulo.id} · ${estado}${titulo ? `: ${titulo}` : ''}`,
  };
}

function construirMensaje({ fecha, total, medios, porMedio }) {
  const cabecera = total === 1
    ? '1 correo recibido hoy.'
    : `${total} correos recibidos hoy.`;
  const asunto = total === 0
    ? `Resumen ${fecha} · ningún correo`
    : `Resumen ${fecha} · ${total} correo${total === 1 ? '' : 's'}`;

  const bloquesTexto = [`Resumen del ${fecha}`, cabecera, ''];
  const bloquesHtml = [];

  for (const medio of medios) {
    const notas = porMedio.get(medio.id) || [];
    const nombre = medio.slug === 'laglam' ? 'La Glam' : (medio.nombre || medio.slug);
    bloquesTexto.push(`${nombre} — ${notas.length ? notas.length : 'ninguno'}`);
    const items = [];
    if (!notas.length) {
      bloquesTexto.push('  Ningún correo.');
      items.push('<p style="margin:0;color:#64748b;">Ningún correo.</p>');
    }
    for (const nota of notas) {
      const hora = horaCorta(nota.fecha_recepcion);
      const de = nota.remitente || 'remitente desconocido';
      const tituloNota = String(nota.asunto || 'Sin asunto').replace(/\s+/g, ' ').trim() || 'Sin asunto';
      const estado = estadoNota(nota, nota.articulos);
      const aviso = avisoNota(nota);
      const arts = nota.articulos.map(lineaArticulo);
      bloquesTexto.push(`  ${hora} · ${de}`);
      bloquesTexto.push(`  ${tituloNota}`);
      if (estado) bloquesTexto.push(`  ${estado}`);
      for (const art of arts) bloquesTexto.push(`  ${art.texto}`);
      if (aviso && nota.estado === 'error_procesamiento') bloquesTexto.push(`  ${aviso}`);
      bloquesTexto.push(`  ${fotosTexto(nota.fotos)}`);
      bloquesTexto.push('');

      const detalleArts = arts.map((art) => `<div style="margin-top:4px;"><strong>${escapar(art.estado)}</strong>${art.titulo ? ` · ${escapar(art.titulo)}` : ''}</div>`).join('');
      const detalleEstado = estado
        ? `<div style="margin-top:4px;color:#9f1239;">${escapar(estado)}</div>`
        : '';
      const detalleAviso = aviso && nota.estado === 'error_procesamiento'
        ? `<div style="margin-top:4px;color:#9f1239;">${escapar(aviso)}</div>`
        : '';
      items.push(`
        <div style="padding:12px 0;border-top:1px solid #e2e8f0;">
          <div style="color:#64748b;font-size:13px;">${escapar(hora)} · ${escapar(de)}</div>
          <div style="margin-top:4px;font-weight:600;color:#0f172a;">${escapar(tituloNota)}</div>
          ${detalleEstado}
          ${detalleArts}
          ${detalleAviso}
          <div style="margin-top:4px;color:#64748b;font-size:13px;">${escapar(fotosTexto(nota.fotos))}</div>
        </div>`);
    }
    bloquesTexto.push('');
    bloquesHtml.push(`
      <h2 style="margin:28px 0 8px;font-size:18px;color:#0f172a;">${escapar(nombre)} <span style="color:#64748b;font-weight:500;font-size:14px;">· ${notas.length ? notas.length : 'ninguno'}</span></h2>
      ${items.join('')}`);
  }

  bloquesTexto.push(`Panel: ${PANEL}`);
  const texto = bloquesTexto.join('\n');
  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
    <p style="margin:0;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">Panel editorial</p>
    <h1 style="margin:8px 0 0;font-size:26px;line-height:1.3;">Resumen del ${escapar(fecha)}</h1>
    <p style="margin:12px 0 0;font-size:16px;">${escapar(cabecera)}</p>
    ${bloquesHtml.join('')}
    <p style="margin:28px 0 0;font-size:14px;"><a href="${PANEL}" style="color:#4338ca;">Abrir el panel</a></p>
  </div>
</body>
</html>`;

  return { asunto, texto, html };
}

async function enviar(supabase, mensaje) {
  const { data: medio, error } = await supabase
    .from('medios')
    .select('email_pop_user, email_pop_password, email_pop_host')
    .eq('slug', 'vidaystyle')
    .maybeSingle();
  if (error || !medio?.email_pop_user || !medio?.email_pop_password) {
    throw new Error('El buzón de Vida&Style no está listo para enviar el resumen.');
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

  await transporter.sendMail({
    from: `"Panel editorial" <${medio.email_pop_user}>`,
    to: DESTINO,
    subject: mensaje.asunto,
    text: mensaje.texto,
    html: mensaje.html,
  });
}

const vista = process.argv.includes('--vista');
const forzar = vista || process.argv.includes('--ahora') || process.env.RESUMEN_FORZAR === '1';
const ahora = new Date();

if (!forzar && horaMadrid(ahora) !== 20) {
  console.log(`No son las 20:00 en Madrid (hora ${horaMadrid(ahora)}). No envío el resumen.`);
  process.exit(0);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Faltan SUPABASE_URL o la clave de Supabase.');
  process.exit(1);
}

const supabase = createClient(url, key);
const desde = inicioDiaMadrid(ahora).toISOString();
const dia = await cargarDia(supabase, desde, ahora.toISOString());
const mensaje = construirMensaje({
  fecha: fechaLarga(ahora),
  total: dia.total,
  medios: dia.medios,
  porMedio: dia.porMedio,
});

if (vista) {
  console.log(mensaje.asunto);
  console.log(mensaje.texto);
  process.exit(0);
}

try {
  await enviar(supabase, mensaje);
  console.log(`Resumen enviado a ${DESTINO}. Correos del día: ${dia.total}.`);
} catch (error) {
  const limpio = String(error?.message || error).replace(/pass(word)?[=:]\s*\S+/gi, 'password');
  console.error(`No se pudo enviar el resumen: ${limpio}`);
  process.exit(1);
}
