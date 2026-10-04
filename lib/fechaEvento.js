const MESES = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
  gener: 1,
  febrer: 2,
  marc: 3,
  març: 3,
  maig: 5,
  juny: 6,
  juliol: 7,
  agost: 8,
  setembre: 9,
  novembre: 11,
  desembre: 12,
};

function fechaValida(anio, mes, dia) {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return fecha;
}

export function extraerFechaEvento(texto, ahora = new Date()) {
  const fuente = String(texto || '').slice(0, 4000);
  const encontradas = [];

  const anadir = (anio, mes, dia, anioExplicito) => {
    let year = anio || ahora.getFullYear();
    let fecha = fechaValida(year, mes, dia);
    if (!fecha) return;
    if (!anioExplicito && fecha.getTime() < ahora.getTime() - 2 * 86400000) {
      fecha = fechaValida(year + 1, mes, dia);
    }
    if (fecha) encontradas.push(fecha);
  };

  for (const match of fuente.matchAll(
    /(\d{1,2})\s+d(?:e|['’])\s*([a-záéíóúñç]+)(?:\s+d(?:e|['’])\s*(\d{4}))?/gi,
  )) {
    const mes = MESES[match[2].toLowerCase()];
    if (!mes) continue;
    anadir(match[3] ? Number(match[3]) : null, mes, Number(match[1]), Boolean(match[3]));
  }

  for (const match of fuente.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g)) {
    anadir(Number(match[3]), Number(match[2]), Number(match[1]), true);
  }

  const recientes = encontradas.filter(
    (fecha) => fecha.getTime() >= ahora.getTime() - 2 * 86400000,
  );
  recientes.sort((a, b) => a.getTime() - b.getTime());
  return recientes[0] ? recientes[0].toISOString().slice(0, 10) : null;
}

function marcaTiempo(valor) {
  const tiempo = Date.parse(valor || '');
  return Number.isFinite(tiempo) ? tiempo : null;
}

export function compararColaEditorial(a, b, ahora = Date.now()) {
  const progA = marcaTiempo(a.fecha_programada);
  const progB = marcaTiempo(b.fecha_programada);
  if (progA != null && progB != null) return progA - progB;
  if (progA != null) return -1;
  if (progB != null) return 1;

  const eventoDe = (item) => {
    const guardada = marcaTiempo(item.fecha_evento);
    if (guardada != null) return guardada;
    const texto = `${item.titulo_generado || ''} ${item.notas_prensa?.asunto || ''}`;
    const extraida = extraerFechaEvento(texto, new Date(ahora));
    return extraida ? marcaTiempo(extraida) : null;
  };

  const umbral = ahora - 2 * 86400000;
  const evA = eventoDe(a);
  const evB = eventoDe(b);
  const vivaA = evA != null && evA >= umbral;
  const vivaB = evB != null && evB >= umbral;
  if (vivaA && vivaB) return evA - evB;
  if (vivaA) return -1;
  if (vivaB) return 1;

  return marcaTiempo(b.fecha_creacion) - marcaTiempo(a.fecha_creacion);
}
