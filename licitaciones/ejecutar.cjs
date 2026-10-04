#!/usr/bin/env node
// Correo diario de licitaciones en plazo.
// Uso: node licitaciones/ejecutar.cjs [--sin-envio] [--max-paginas 10] [--max-paginas-inicial 30] [--atras-dias 21]
// El primer día recorre más páginas. Los siguientes solo leen lo nuevo desde el estado guardado.

const fs = require('fs');
const path = require('path');

require('dotenv').config();

const { evaluar } = require('./perfil.cjs');
const { parsearEntrada } = require('./parsear.cjs');
const { FUENTES, descargarConReintento, recorrerFeed } = require('./fuentes.cjs');
const { construirMensaje, enviarCorreo } = require('./correo.cjs');

const DIA = 24 * 60 * 60 * 1000;
const ESTADO_DEFECTO = path.join(__dirname, 'estado.json');

function args(argv) {
  const opciones = {
    sinEnvio: false,
    maxPaginas: 10,
    maxPaginasInicial: 30,
    atrasDias: 21,
    estado: ESTADO_DEFECTO,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--sin-envio') opciones.sinEnvio = true;
    if (arg === '--max-paginas') opciones.maxPaginas = Number(argv[++i]);
    if (arg === '--max-paginas-inicial') opciones.maxPaginasInicial = Number(argv[++i]);
    if (arg === '--atras-dias') opciones.atrasDias = Number(argv[++i]);
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

function fechaTexto(fecha = new Date()) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fecha);
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
  const estado = leerEstado(opciones.estado);
  estado.licitaciones ||= {};
  const clavesPrevias = new Set(Object.keys(estado.licitaciones));
  const primerRecorrido = !estado.watermark;
  const desdeEpoch = primerRecorrido
    ? Date.now() - opciones.atrasDias * DIA
    : estado.watermark - 6 * 60 * 60 * 1000;
  const maxPaginas = primerRecorrido ? opciones.maxPaginasInicial : opciones.maxPaginas;
  const ahora = ahoraMadrid();
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

  const licitaciones = Object.values(estado.licitaciones);
  const nuevas = new Set(licitaciones.filter((ficha) => !clavesPrevias.has(ficha.clave)).map((ficha) => ficha.clave));
  const resumenMotivos = Object.entries(motivos)
    .map(([motivo, total]) => `${motivo} ${total}`)
    .join(', ');
  const mensaje = construirMensaje({
    fechaTexto: fechaTexto(),
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
  console.log(`Correo enviado a ${process.env.LICITACIONES_EMAIL_TO || 'javisaezz@gmail.com'}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
