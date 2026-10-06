const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const PRIMERA_PROGRAMADA = '2026-10-06T07:40:00';
const DESDE_VIERNES = '2026-10-02T00:00:00';

function sumarDias(dia, cantidad) {
  const fecha = new Date(`${dia}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + cantidad);
  return fecha.toISOString().slice(0, 10);
}

function madridAEpoch(iso) {
  const utc = new Date(`${iso}Z`);
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utc);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  const hora = valor('hour') === '24' ? '00' : valor('hour');
  const visto = Date.parse(`${valor('year')}-${valor('month')}-${valor('day')}T${hora}:${valor('minute')}:${valor('second')}Z`);
  return Date.parse(`${iso}Z`) - (visto - utc.getTime());
}

function ventanaProgramada(ahora, ultimoHasta) {
  const hoy = ahora.slice(0, 10);
  const hasta = ahora.slice(11, 16) >= '07:40' ? `${hoy}T07:40:00` : `${sumarDias(hoy, -1)}T07:40:00`;
  let desde = `${sumarDias(hasta.slice(0, 10), -1)}T07:40:00`;
  if (ultimoHasta && ultimoHasta < desde) desde = ultimoHasta;
  return { desde, hasta };
}

function dentroDeVentana(ficha, desde, hasta) {
  if (ficha.publicacion) {
    const dia = ficha.publicacion;
    const diaDesde = desde.slice(0, 10);
    const diaHasta = hasta.slice(0, 10);
    if (dia === diaHasta) return true;
    if (dia > diaDesde && dia < diaHasta) return true;
    if (dia === diaDesde) return `${dia}T23:59:59` >= desde;
    return false;
  }
  return Boolean(ficha.actualizadoMadrid) && ficha.actualizadoMadrid >= desde && ficha.actualizadoMadrid < hasta;
}

function fechaHumana(iso) {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  const hora = iso.slice(11, 16);
  const indice = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return `${DIAS[indice]} ${dia} de ${MESES[mes - 1]}, ${hora}`;
}

function puedeEnviarProgramado(ahora, ultimoHasta) {
  if (ahora < PRIMERA_PROGRAMADA) return false;
  if (ahora.slice(11, 16) < '07:40') return false;
  const corte = `${ahora.slice(0, 10)}T07:40:00`;
  if (ultimoHasta && ultimoHasta >= corte) return false;
  return true;
}

module.exports = {
  PRIMERA_PROGRAMADA,
  DESDE_VIERNES,
  madridAEpoch,
  ventanaProgramada,
  dentroDeVentana,
  fechaHumana,
  puedeEnviarProgramado,
};
