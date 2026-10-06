#!/usr/bin/env node
// Correo diario de licitaciones en plazo.
// Uso: node licitaciones/ejecutar.cjs [--modo viernes|programado] [--sin-envio]

const fs = require('fs');
const path = require('path');

require('dotenv').config();

const { evaluar } = require('./perfil.cjs');
const { parsearEntrada } = require('./parsear.cjs');
const { FUENTES, descargarConReintento, recorrerFeed } = require('./fuentes.cjs');
const { construirMensaje, enviarCorreo } = require('./correo.cjs');
const {
  DESDE_VIERNES,
  madridAEpoch,
  ventanaProgramada,
  dentroDeVentana,
  fechaHumana,
  puedeEnviarProgramado,
} = require('./ventana.cjs');

const ESTADO_DEFECTO = path.join(__dirname, 'estado.json');

function args(argv) {
  const opciones = {
    sinEnvio: false,
    maxPaginas: 12,
    modo: 'viernes',
    estado: ESTADO_DEFECTO,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--sin-envio') opciones.sinEnvio = true;
    if (arg === '--max-paginas') opciones.maxPaginas = Number(argv[++i]);
    if (arg === '--modo') opciones.modo = argv[++i];
    if (arg === '--estado') opciones.estado = argv[++i];
  }
  return opciones;
}

function ahoraMadrid(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  const hora = valor('hour') === '24' ? '00' : valor('hour');
  return `${valor('year')}-${valor('month')}-${valor('day')}T${hora}:${valor('minute')}:${valor('second')}`;
}

function leerEstado(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return { watermark: 0, licitaciones: {} };
  }
}

function guardarEstado(ruta, estado) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const temporal = `${ruta}.tmp`;
  fs.writeFileSync(temporal, JSON.stringify(estado, null, 2));
  fs.renameSync(temporal, ruta);
}

async function main() {
  const opciones = args(process.argv.slice(2));
  const ahora = ahoraMadrid();
  const estado = leerEstado(opciones.estado);
  estado.licitaciones ||= {};
  estado.enviadas ||= {};
  if (opciones.modo === 'programado' && !puedeEnviarProgramado(ahora, estado.ultimoHasta)) {
    const corte = `${ahora.slice(0, 10)}T07:40:00`;
    const motivo = ahora < '2026-10-06T07:40:00'
      ? 'El primer parte de las 7:40 es el martes 6 de octubre.'
      : estado.ultimoHasta >= corte
        ? 'El parte de hoy ya se envió.'
        : 'Aún no son las 7:40 en Madrid.';
    console.log(`Todavía no toca. ${motivo} Ahora en Madrid: ${ahora}`);
    return;
  }
  const repaso = opciones.modo === 'viernes' || opciones.modo === 'prueba';
  const tramo = repaso
    ? { desde: DESDE_VIERNES, hasta: ahora }
    : estado.ultimoHasta
      ? ventanaProgramada(ahora, estado.ultimoHasta)
      : { desde: DESDE_VIERNES, hasta: ventanaProgramada(ahora, null).hasta };
  const inicioFeed = madridAEpoch(tramo.desde) - 6 * 60 * 60 * 1000;
  const desdeEpoch = repaso || !estado.watermark
    ? inicioFeed
    : Math.max(inicioFeed, estado.watermark - 60 * 60 * 1000);
  console.log(`Tramo ${tramo.desde} → ${tramo.hasta}`);
  const maxPaginas = repaso ? Math.max(opciones.maxPaginas, 30) : opciones.maxPaginas;
  const hoy = ahora.slice(0, 10);
  const motivos = {};
  const vistas = new Set();
  let watermark = estado.watermark || 0;
  const fuentesResumen = [];

  for (const fuente of FUENTES) {
    try {
      const resultado = await recorrerFeed({
        urlInicial: fuente.url,
        desdeEpoch,
        maxPaginas,
        bajar: descargarConReintento,
        onEntry: async (xml) => {
          const item = parsearEntrada(xml);
          if (item.actualizadoEpoch > watermark) watermark = item.actualizadoEpoch;
          if (!item.clave || vistas.has(item.clave)) return;
          vistas.add(item.clave);
          const decision = evaluar(item, ahora);
          if (!decision.ok) {
            motivos[decision.motivo] = (motivos[decision.motivo] || 0) + 1;
            if (estado.licitaciones[item.clave]) delete estado.licitaciones[item.clave];
            return;
          }
          const previa = estado.licitaciones[item.clave];
          estado.licitaciones[item.clave] = {
            ...decision.ficha,
            actualizadoMadrid: item.actualizadoEpoch ? ahoraMadrid(new Date(item.actualizadoEpoch)) : '',
            vista: previa?.vista || hoy,
          };
        },
      });
      fuentesResumen.push(`${fuente.nombre}: ${resultado.paginas} páginas, ${resultado.entradas} avisos`);
      console.log(`${fuente.nombre}: ${resultado.paginas} páginas, ${resultado.entradas} avisos`);
    } catch (error) {
      fuentesResumen.push(`${fuente.nombre}: no se pudo leer (${error.message})`);
      console.error(`${fuente.nombre}: ${error.message}`);
    }
  }

  for (const [clave, ficha] of Object.entries(estado.licitaciones)) {
    if (!ficha.tope || ficha.tope <= ahora) delete estado.licitaciones[clave];
  }

  estado.watermark = watermark;
  guardarEstado(opciones.estado, estado);

  const periodo = `del ${fechaHumana(tramo.desde)} al ${fechaHumana(tramo.hasta)}`;
  const licitaciones = Object.values(estado.licitaciones).filter(
    (ficha) => dentroDeVentana(ficha, tramo.desde, tramo.hasta) && (opciones.modo === 'prueba' || !estado.enviadas[ficha.clave]),
  );
  const nuevas = new Set(licitaciones.map((ficha) => ficha.clave));
  const resumenMotivos = Object.entries(motivos)
    .map(([motivo, total]) => `${motivo} ${total}`)
    .join(', ');
  const mensaje = construirMensaje({
    fechaTexto: periodo,
    licitaciones,
    nuevas,
    resumenFuentes: `${fuentesResumen.join(' · ')}. Descartes de este recorrido: ${resumenMotivos || 'ninguno'}.`,
  });

  const salida = path.join(__dirname, 'salida');
  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, 'ultimo.txt'), mensaje.texto);
  fs.writeFileSync(path.join(salida, 'ultimo.html'), mensaje.html);
  console.log(`En plazo: ${licitaciones.length}. Nuevas: ${nuevas.size}.`);
  console.log(resumenMotivos || 'Sin descartes');

  if (opciones.sinEnvio) return;
  await enviarCorreo(mensaje);
  for (const ficha of licitaciones) estado.enviadas[ficha.clave] = tramo.hasta;
  estado.ultimoHasta = tramo.hasta;
  guardarEstado(opciones.estado, estado);
  console.log(`Correo enviado a ${process.env.LICITACIONES_EMAIL_TO || 'javisaezz@gmail.com'}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
