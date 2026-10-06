// Perfil de oferta. Edita palabras y CPV aquí: el correo diario solo aplica estas reglas.
// Importe: valor estimado sin IVA. Territorio: sede o lugar de ejecución.

const { encajar } = require('./encaje.cjs');

const IMPORTE_MINIMO = 7000;

const AREAS = [
  {
    id: 'comunicacion',
    etiqueta: 'Comunicación y eventos',
    minimo: 7000,
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
      'comunicado de prensa',
      'comunicados de prensa',
      'nota de prensa',
      'notas de prensa',
      'gabinete de prensa',
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
    etiqueta: 'TIC, datos, PMO y videovigilancia',
    minimo: 30000,
    cpv: ['72'],
    palabras: [
      { frase: 'consultoria', puntos: 1 },
      { frase: 'datos', puntos: 1 },
      { frase: 'proyecto', puntos: 1 },
      { frase: 'proyectos', puntos: 1 },
      { frase: 'plataforma', puntos: 1 },
      { frase: 'oficina', puntos: 1 },
      { frase: 'sistemas', puntos: 1 },
      { frase: 'software', puntos: 1 },
      { frase: 'digital', puntos: 1 },
      { frase: 'tecnolog', puntos: 1 },
      { frase: 'pliego', puntos: 1 },
      { frase: 'pliegos', puntos: 1 },
      { frase: 'plec', puntos: 1 },
      { frase: 'plecs', puntos: 1 },
      { frase: 'gobernanza', puntos: 1 },
      { frase: 'governanza', puntos: 1 },
      { frase: 'catalogo', puntos: 1 },
      { frase: 'videovigilancia', puntos: 1 },
      'pmo',
      'oficina de proyectos',
      'oficina de proyecto',
      'oficina de gestion de proyectos',
      'oficina del dato',
      'oficinas del dato',
      'oficina de datos',
      'oficina de la dada',
      'gobierno del dato',
      'gobierno de datos',
      'gobernanza del dato',
      'gobernanza de datos',
      'governanza del dato',
      'governanza de datos',
      'govern de la dada',
      'governanca de les dades',
      'catalogo de datos',
      'catalogos de datos',
      'cataleg de dades',
      'plataforma de datos',
      'espacio de datos',
      'proyecto de datos',
      'proyectos de datos',
      'gestion de datos',
      'estrategia de datos',
      'calidad del dato',
      'base de datos',
      'bases de datos',
    ],
  },
  {
    id: 'empresa',
    etiqueta: 'Mentoría, pymes y formación',
    minimo: 7000,
    cpv: [],
    palabras: [
      'mentoria',
      'mentorias',
      'mentor',
      'coaching',
      'tutorizacion',
      'pymes',
      'pyme',
      'pimes',
      'pime',
      'emprendimiento',
      'emprenedoria',
      'asesoramiento empresarial',
      'asesoramiento a empresas',
      'asesoramiento a pymes',
      'acompanamiento empresarial',
      'promocion comercial',
      'promocion del comercio',
      'reactivacion comercial',
      'dinamizacion comercial',
      'dinamizacion del comercio',
      'dinamizacion de comercio',
      'dinamitzacio comercial',
      'formacion empresarial',
      'formacio empresarial',
      'economia circular',
      'transformacion digital',
    ],
  },
];

const PRIORIDAD = ['tic', 'empresa', 'comunicacion'];

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
  if (limpio.startsWith('ES51') || limpio.startsWith('ES30') || limpio.startsWith('ES24') || limpio.startsWith('ES52') || limpio.startsWith('ES53')) return true;
  return ['08', '8', '17', '25', '43', '28', '22', '44', '50', '03', '3', '12', '46', '07', '7'].includes(limpio);
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
    'valencia',
    'alacant',
    'alicante',
    'castellon',
    'castello',
    'balears',
    'baleares',
    'mallorca',
    'menorca',
    'eivissa',
    'ibiza',
    'formentera',
    'palma',
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

function hablaDeTic(texto) {
  return /\b(tic|tecnolog\w*|informati\w*|software|digital\w*|ciber\w*)\b/.test(texto);
}

function puntosExtra(areaId, texto) {
  if (areaId === 'comunicacion' && /\borganizacion\b/.test(texto) && /\b(evento|eventos|congreso|gala|feria|salon|jornada|jornadas|acto|actos)\b/.test(texto)) {
    return 2;
  }
  if (areaId !== 'tic' && areaId !== 'empresa') return 0;
  const limpio = texto.replace(/\bdatos personales\b/g, ' ').replace(/\bproteccion de datos\b/g, ' ');
  if (areaId === 'tic') {
    let extra = 0;
    if (/\boficina tecnica\b/.test(limpio) && hablaDeTic(limpio)) extra += 2;
    if (/\b(pliego|pliegos|plec|plecs)\b/.test(limpio) && /\b(redaccion|redactar|soporte|asistencia|elaboracion)\b/.test(limpio) && hablaDeTic(limpio)) extra += 2;
    if (/\bconsultoria\b/.test(limpio) && hablaDeTic(limpio)) extra += 2;
    if (/\basistencia tecnica\b/.test(limpio) && hablaDeTic(limpio)) extra += 2;
    const video = /\b(videovigilancia|cctv|circuito cerrado)\b/.test(limpio);
    const plataforma = /\b(plataforma|software|nube|cloud|vsaas|vsas|centro de control|analitica|explotacion)\b/.test(limpio);
    if (video && plataforma) extra += 5;
    return extra;
  }
  const curso = /\b(curso|cursos|formacion|formacio)\b/.test(limpio);
  const paraEntidades = /\b(entidad|entidades|asociacion|asociaciones|empresa|empresas|pymes|pyme|pimes|pime)\b/.test(limpio);
  const empresarial = /\b(empresarial|emprend\w*|negocio|directiv\w*|comercial|pymes|pyme|pimes)\b/.test(limpio);
  if (curso && (hablaDeTic(limpio) || empresarial) && (paraEntidades || empresarial || hablaDeTic(limpio))) return 2;
  if (/\b(pymes|pyme|pimes|pime)\b/.test(limpio) && /\b(mentoria|coaching|formacion|formacio|curso|cursos|dinamizacion|dinamitzacio|asesoramiento|acompana\w*)\b/.test(limpio)) return 2;
  if (/\basesoramiento\b/.test(limpio) && /\b(empresa|empresas|pymes|pyme|pimes)\b/.test(limpio)) return 2;
  if (/\beconomia circular\b/.test(limpio) && /\b(empresa|empresas|pymes|industria)\b/.test(limpio)) return 2;
  return 0;
}

function clasificar(item) {
  const texto = textoDeOferta(item.texto);
  const cpvs = item.cpvs || [];
  const puntos = new Map();

  for (const area of AREAS) {
    const textoArea = area.id === 'tic'
      ? texto.replace(/\bdatos personales\b/g, ' ').replace(/\bproteccion de datos\b/g, ' ')
      : texto;
    const porCpv = area.cpv.some((prefijo) => cpvs.some((cpv) => cpv.startsWith(prefijo)));
    let porPalabra = puntosExtra(area.id, textoArea);
    for (const palabra of area.palabras) {
      const frase = typeof palabra === 'string' ? palabra : palabra.frase;
      const peso = typeof palabra === 'string' ? 2 : palabra.puntos;
      const escapada = frase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = peso < 2 && /^(tecnolog|digital|informatic|ciber)/.test(frase)
        ? new RegExp(`\\b${escapada}\\w*`)
        : new RegExp(`\\b${escapada}\\b`);
      if (regex.test(textoArea)) porPalabra += peso;
    }
    // TIC: cualquier servicio CPV 72 por encima del mínimo entra, aunque el título sea genérico.
    if (porPalabra < 1 && !(area.id === 'tic' && porCpv)) continue;
    if (porPalabra < 2 && !porCpv) continue;
    puntos.set(area.id, porPalabra + (porCpv ? 3 : 0));
  }

  const candidatas = [...puntos.entries()].filter(([, total]) => total >= 2);
  if (!candidatas.length) return { tipo: 'tema' };
  const validas = candidatas.filter(([id]) => item.importe >= AREAS.find((area) => area.id === id).minimo);
  if (!validas.length) return { tipo: 'importe' };
  validas.sort((a, b) => b[1] - a[1] || PRIORIDAD.indexOf(a[0]) - PRIORIDAD.indexOf(b[0]));
  const [ganadora, ...resto] = validas;
  return {
    tipo: 'ok',
    id: ganadora[0],
    etiqueta: AREAS.find((area) => area.id === ganadora[0]).etiqueta,
    tambien: resto.map(([id]) => ({
      id,
      etiqueta: AREAS.find((area) => area.id === id).etiqueta,
    })),
  };
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
  if (/\b(mantenimiento|mantenimientos|manteniment|manteniments)\b/.test(normalizar(item.titulo))) {
    return { ok: false, motivo: 'mantenimiento' };
  }
  const area = clasificar(item);
  if (area.tipo !== 'ok') return { ok: false, motivo: area.tipo };
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
      encaje: encajar({
        titulo: item.titulo,
        organo: item.organo,
        texto: item.texto,
        area: area.id,
      }),
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
