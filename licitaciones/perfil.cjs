// Perfil de oferta. Edita palabras y CPV aquí: el correo diario solo aplica estas reglas.
// Importe: valor estimado sin IVA. Territorio: sede o lugar de ejecución.

const IMPORTE_MINIMO = 7000;

const AREAS = [
  {
    id: 'comunicacion',
    etiqueta: 'Comunicación y eventos',
    cpv: ['79950', '79951', '79952', '79416', '7934', '92111', '92112'],
    palabras: [
      'gala',
      'protocolo institucional',
      'protocolo oficial',
      'protocolo de actos',
      'acto institucional',
      'actos institucionales',
      'direccion de acto',
      'direccion tecnica del acto',
      'organizacion de evento',
      'organizacion de eventos',
      'organizacion del evento',
      'produccion de evento',
      'produccion de eventos',
      'produccion del evento',
      'campana de comunicacion',
      'campana de publicidad',
      'publicidad institucional',
      'plan de comunicacion',
      'gabinete de comunicacion',
      'comunicacion institucional',
      'comunicacion corporativa',
      'comunicacion digital',
      'estrategia de comunicacion',
      'presentacion institucional',
      { frase: 'congreso', puntos: 1 },
      { frase: 'feria', puntos: 1 },
      { frase: 'salon', puntos: 1 },
      { frase: 'evento', puntos: 1 },
      { frase: 'eventos', puntos: 1 },
      { frase: 'jornada', puntos: 1 },
      { frase: 'jornadas', puntos: 1 },
    ],
  },
  {
    id: 'tic',
    etiqueta: 'TIC, datos y PMO',
    cpv: ['7232', '72224'],
    palabras: [
      'oficina del dato',
      'oficinas del dato',
      'oficina de datos',
      'gobierno del dato',
      'gobierno de datos',
      'base de datos',
      'bases de datos',
      'plataforma de datos',
      'pmo',
      'oficina de proyectos',
      'oficina de proyecto',
    ],
  },
  {
    id: 'mentoria',
    etiqueta: 'Mentoría',
    cpv: [],
    palabras: ['mentoria', 'mentorias', 'mentor', 'tutorizacion', 'programa de mentores'],
  },
  {
    id: 'dinamizacion',
    etiqueta: 'Dinamización comercial',
    cpv: [],
    palabras: [
      'dinamizacion comercial',
      'dinamizacion del comercio',
      'dinamizacion de comercio',
      'dinamizacion economica',
      'promocion comercial',
      'promocion del comercio',
      'promocion economica',
      'comercio local',
      'comercio de proximidad',
      'asociacion de comerciantes',
      'asociaciones de comerciantes',
      'asociaciones empresariales',
      'desarrollo comercial',
    ],
  },
  {
    id: 'videovigilancia',
    etiqueta: 'Videovigilancia',
    cpv: [],
    palabras: [],
  },
];

const PRIORIDAD = ['videovigilancia', 'comunicacion', 'tic', 'mentoria', 'dinamizacion'];

const ALQUILER_GRANDE = [
  'local',
  'locales',
  'nave',
  'naves',
  'espacio',
  'espacios',
  'carpa',
  'carpas',
  'escenario',
  'escenarios',
  'grada',
  'gradas',
  'pabellon',
  'recinto',
  'sala',
  'salas',
  'vehiculo',
  'vehiculos',
  'maquinaria',
  'andamio',
  'andamiaje',
  'silla',
  'sillas',
  'mobiliario',
  'sonido',
  'audiovisual',
  'iluminacion',
  'tarima',
  'tarimas',
  'vallado',
  'sanitario',
  'sanitarios',
  'montaje',
];

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function enTerritorio(item) {
  if (item.lugares?.length) {
    return item.lugares.some((lugar) => codigoDeAqui(lugar.codigo) || nombreDeAqui(lugar.nombre));
  }
  if (ejecucionAjena(item.texto)) return false;
  return Boolean(item.organoLugar) && (codigoDeAqui(item.organoLugar.codigo) || nombreDeAqui(item.organoLugar.nombre));
}

function ejecucionAjena(texto) {
  return /\b(uruguay|argentina|mexico|colombia|chile|peru|brasil|brazil|francia|portugal|italia|alemania|marruecos|andorra|ecuador|bolivia|paraguay|panama|estados unidos|reino unido|china|japon)\b/.test(
    normalizar(texto),
  );
}

function codigoDeAqui(codigo) {
  const limpio = String(codigo || '').trim().toUpperCase();
  if (!limpio) return false;
  if (limpio.startsWith('ES51') || limpio.startsWith('ES30') || limpio.startsWith('ES24')) return true;
  return ['08', '8', '17', '25', '43', '28', '22', '44', '50'].includes(limpio);
}

function nombreDeAqui(nombre) {
  const texto = normalizar(nombre);
  if (!texto) return false;
  return [
    'barcelona',
    'girona',
    'gerona',
    'lleida',
    'lerida',
    'tarragona',
    'catalunya',
    'cataluna',
    'madrid',
    'huesca',
    'teruel',
    'zaragoza',
    'aragon',
  ].some((sitio) => texto.includes(sitio));
}

function esCatering(item) {
  if ((item.cpvs || []).some((cpv) => cpv.startsWith('5551') || cpv.startsWith('5552'))) return true;
  return /\b(catering|restauracion|servicio de comidas|coffee break|coctel)\b/.test(normalizar(item.texto));
}

function llevaAlquilerGrande(item) {
  const texto = normalizar(item.texto).replace(
    /\bsin\s+(?:el\s+|la\s+|los\s+|las\s+)?(?:alquiler|alquileres|arrendamiento|renting)\b[^.]{0,50}/g,
    ' ',
  );
  if (!/\b(alquiler|alquileres|arrendamiento|renting)\b/.test(texto)) return false;
  const grande = ALQUILER_GRANDE.some((palabra) => new RegExp(`\\b${palabra}\\b`).test(texto));
  const soloSoftware =
    /\b(software|licencia|licencias|plataforma|nube|cloud|servidor)\b/.test(texto) && !grande;
  return !soloSoftware;
}

function soloCamaras(item) {
  const texto = normalizar(item.texto);
  const video = /\b(videovigilancia|cctv|circuito cerrado)\b/.test(texto);
  if (!video) return false;
  const plataforma = /\b(plataforma|software|nube|cloud|vsaas|vsas|centro de control|analitica|explotacion|inteligencia artificial)\b/.test(
    texto,
  );
  return !plataforma;
}

function textoDeOferta(texto) {
  return normalizar(texto)
    .replace(/\bcongreso de los diputados\b/g, ' ')
    .replace(/\bedifact\b/g, ' ')
    .replace(/\bprotocolo edi\w*\b/g, ' ')
    .replace(/\bprotocolo de transferencia\b/g, ' ');
}

function clasificar(item) {
  const texto = textoDeOferta(item.texto);
  const cpvs = item.cpvs || [];
  const puntos = new Map();

  const video = /\b(videovigilancia|cctv|circuito cerrado)\b/.test(texto);
  const plataforma = /\b(plataforma|software|nube|cloud|vsaas|vsas|centro de control|analitica|explotacion|inteligencia artificial)\b/.test(
    texto,
  );
  if (video && plataforma) puntos.set('videovigilancia', 5);

  for (const area of AREAS) {
    if (area.id === 'videovigilancia') continue;
    const porCpv = area.cpv.some((prefijo) => cpvs.some((cpv) => cpv.startsWith(prefijo)));
    let porPalabra = 0;
    for (const palabra of area.palabras) {
      const frase = typeof palabra === 'string' ? palabra : palabra.frase;
      const peso = typeof palabra === 'string' ? 2 : palabra.puntos;
      const regex = new RegExp(`\\b${frase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (regex.test(texto)) porPalabra += peso;
    }
    if (area.id === 'comunicacion' && /\borganizacion\b/.test(texto) && /\b(evento|eventos|congreso|gala|feria|salon|jornada|jornadas|acto|actos)\b/.test(texto)) {
      porPalabra += 2;
    }
    if (porPalabra < 1) continue;
    if (porPalabra < 2 && !porCpv) continue;
    puntos.set(area.id, porPalabra + (porCpv ? 3 : 0));
  }

  const candidatas = [...puntos.entries()].filter(([, total]) => total >= 2);
  if (!candidatas.length) return null;
  candidatas.sort((a, b) => b[1] - a[1] || PRIORIDAD.indexOf(a[0]) - PRIORIDAD.indexOf(b[0]));
  const [ganadora] = candidatas;
  const etiqueta = AREAS.find((area) => area.id === ganadora[0]).etiqueta;
  const tambien = candidatas.slice(1).map(([id]) => ({
    id,
    etiqueta: AREAS.find((area) => area.id === id).etiqueta,
  }));
  return { id: ganadora[0], etiqueta, tambien };
}

function evaluar(item, ahora) {
  if (!item?.titulo || !item?.clave) return { ok: false, motivo: 'sin_datos' };
  if (item.estado !== 'PUB') return { ok: false, motivo: 'estado' };
  if (item.tipo !== '2') return { ok: false, motivo: 'tipo' };
  if (!enTerritorio(item)) return { ok: false, motivo: 'territorio' };
  if (item.importe == null || item.importe < IMPORTE_MINIMO) return { ok: false, motivo: 'importe' };
  if (!item.tope || item.tope <= ahora) return { ok: false, motivo: 'plazo' };
  if (esCatering(item)) return { ok: false, motivo: 'catering' };
  if (llevaAlquilerGrande(item)) return { ok: false, motivo: 'alquiler' };
  if (/\b(construccion del stand|produccion y montaje|montaje del stand|montaje de stand)\b/.test(normalizar(item.texto))) {
    return { ok: false, motivo: 'montaje' };
  }
  if (soloCamaras(item)) return { ok: false, motivo: 'camaras' };
  const area = clasificar(item);
  if (!area) return { ok: false, motivo: 'tema' };
  return {
    ok: true,
    ficha: {
      clave: item.clave,
      titulo: item.titulo,
      organo: item.organo,
      importe: item.importe,
      enlace: item.enlace,
      publicacion: item.publicacion || '',
      tope: item.tope,
      area: area.id,
      etiqueta: area.etiqueta,
      tambien: area.tambien,
      cpvs: item.cpvs,
      actualizado: item.actualizadoEpoch || 0,
    },
  };
}

module.exports = {
  IMPORTE_MINIMO,
  AREAS,
  normalizar,
  enTerritorio,
  evaluar,
  clasificar,
};
