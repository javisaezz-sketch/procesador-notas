const { encajar, pesoEncaje } = require('./encaje.cjs');

const SECCIONES = [
  {
    id: 'comunicacion',
    etiqueta: 'Comunicación y eventos',
    detalle: 'Galas, actos y presentaciones. Menos de 10.000 € con Alejandro; desde 10.000 € con Aube.',
  },
  {
    id: 'tic',
    etiqueta: 'TIC, datos, PMO y videovigilancia',
    detalle: 'Datos, PMO, pliegos, consultoría y videovigilancia con plataforma. Con Aube. Desde 30.000 €.',
  },
  {
    id: 'empresa',
    etiqueta: 'Mentoría, pymes y formación',
    detalle: 'Las mentorías empresariales, con Alejandro. El resto de esta área, con Aube. Desde 7.000 €.',
  },
];

const ORDEN = SECCIONES.map((seccion) => seccion.id);

function fechaCorta(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function fechaTope(iso) {
  if (!iso) return '—';
  const hora = iso.slice(11, 16);
  return hora ? `${fechaCorta(iso)} ${hora}` : fechaCorta(iso);
}

function euros(importe) {
  const texto = String(Math.round(importe)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${texto} €`;
}

function conMarca(ficha) {
  return { ...ficha, encaje: ficha.encaje || encajar(ficha) };
}

function ordenar(lista) {
  return [...lista].map(conMarca).sort((a, b) => {
    const area = ORDEN.indexOf(a.area) - ORDEN.indexOf(b.area);
    if (area) return area;
    const encaje = pesoEncaje(a) - pesoEncaje(b);
    if (encaje) return encaje;
    if (a.tope !== b.tope) return a.tope < b.tope ? -1 : 1;
    return b.importe - a.importe;
  });
}

function porSeccion(licitaciones) {
  const grupos = new Map(SECCIONES.map((seccion) => [seccion.id, []]));
  for (const ficha of ordenar(licitaciones)) {
    if (grupos.has(ficha.area)) grupos.get(ficha.area).push(ficha);
    for (const otra of ficha.tambien || []) {
      if (otra.id && otra.id !== ficha.area && grupos.has(otra.id)) grupos.get(otra.id).push(ficha);
    }
  }
  return grupos;
}

function construirMensaje({ fechaTexto, licitaciones, nuevas, resumenFuentes }) {
  const grupos = porSeccion(licitaciones);

  const asunto = `Licitaciones en plazo · ${fechaTexto} · ${licitaciones.length}`;
  const lineas = [
    `Licitaciones en plazo — ${fechaTexto}`,
    `${licitaciones.length} abiertas · Catalunya, Madrid y Aragón · las tres áreas en cada correo`,
    '',
  ];
  const html = [
    '<div style="font-family:Georgia,serif;color:#1a1a1a;max-width:680px">',
    `<h1 style="font-size:22px;font-weight:normal">Licitaciones en plazo — ${escapar(fechaTexto)}</h1>`,
    `<p>${licitaciones.length} abiertas · Catalunya, Madrid y Aragón · las tres áreas en cada correo</p>`,
  ];

  for (const seccion of SECCIONES) {
    const fichas = grupos.get(seccion.id);
    const titulo = seccion.etiqueta;
    lineas.push(`${titulo} (${fichas.length})`, seccion.detalle, '');
    html.push(
      `<h2 style="font-size:16px;margin:28px 0 8px">${escapar(titulo)} (${fichas.length})</h2>`,
      `<p style="color:#444;margin:0 0 8px">${escapar(seccion.detalle)}</p>`,
    );
    if (!fichas.length) {
      lineas.push('Ninguna en este tramo.', '');
      html.push('<p>Ninguna en este tramo.</p>');
      continue;
    }
    for (const ficha of fichas) {
      const nueva = nuevas?.has(ficha.clave) ? ' · Nueva' : '';
      const tambien = ficha.tambien?.length ? ` · También: ${ficha.tambien.map((item) => item.etiqueta).join(', ')}` : '';
      const encaje = ficha.encaje || encajar(ficha);
      const colorEncaje = encaje.vehiculo === 'alejandro' ? '#0b6e4f' : '#1a4f8b';
      lineas.push(
        `${ficha.titulo}${nueva}`,
        ficha.organo || '',
        `${encaje.marca} · ${encaje.motivo}`,
        `${euros(ficha.importe)}    Publicación ${fechaCorta(ficha.publicacion)}    Tope ${fechaTope(ficha.tope)}${tambien}`,
        ficha.enlace || '',
        '',
      );
      html.push(
        '<div style="border-top:1px solid #ddd;padding:12px 0">',
        `<div style="font-size:16px">${escapar(ficha.titulo)}${nueva ? ' <span style="color:#0b6e4f">Nueva</span>' : ''}</div>`,
        `<div style="color:#444;margin-top:4px">${escapar(ficha.organo || '')}</div>`,
        `<div style="margin-top:6px;color:${colorEncaje}"><strong>${escapar(encaje.marca)}</strong> · ${escapar(encaje.motivo)}</div>`,
        `<div style="margin-top:6px"><strong>${escapar(euros(ficha.importe))}</strong>`,
        ` · Publicación ${escapar(fechaCorta(ficha.publicacion))}`,
        ` · Tope ${escapar(fechaTope(ficha.tope))}`,
        tambien ? ` · ${escapar(tambien.replace(' · ', ''))}` : '',
        '</div>',
        ficha.enlace ? `<div style="margin-top:6px"><a href="${escapar(ficha.enlace)}">Abrir la licitación</a></div>` : '',
        '</div>',
      );
    }
  }

  const pie = resumenFuentes || '';
  if (pie) {
    lineas.push(pie);
    html.push(`<p style="color:#666;font-size:13px;margin-top:28px">${escapar(pie)}</p>`);
  }
  html.push('</div>');
  return { asunto, texto: lineas.filter((linea) => linea !== undefined).join('\n'), html: html.join('') };
}

function escapar(valor) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function enviarCorreo({ asunto, texto, html }) {
  const to = process.env.LICITACIONES_EMAIL_TO || 'javisaezz@gmail.com';
  const host = process.env.LICITACIONES_SMTP_HOST;
  const user = process.env.LICITACIONES_SMTP_USER;
  const pass = process.env.LICITACIONES_SMTP_PASS;
  if (!to || !host || !user || !pass) {
    const error = new Error(
      'Faltan LICITACIONES_SMTP_HOST, LICITACIONES_SMTP_USER o LICITACIONES_SMTP_PASS.',
    );
    error.codigo = 'SIN_SMTP';
    throw error;
  }
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.LICITACIONES_SMTP_PORT || 587),
    secure: process.env.LICITACIONES_SMTP_SECURE === '1',
    requireTLS: process.env.LICITACIONES_SMTP_SECURE !== '1',
    auth: { user, pass: String(pass).replace(/\s/g, '') },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  await transporter.sendMail({
    from: process.env.LICITACIONES_EMAIL_FROM || `"Licitaciones" <${user}>`,
    to,
    subject: asunto,
    text: texto,
    html,
  });
}

module.exports = {
  construirMensaje,
  enviarCorreo,
  fechaCorta,
  fechaTope,
  euros,
};
