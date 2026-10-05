// Con qué sociedad presentarse. Sale de las ofertas ya hechas:
// Alejandro Tomás Picó / Tu Coach: actos, formación, coaching y acompañamiento a empresas.
// Aube Diseño: plecs TIC, gobernanza de datos, arquitectura y dirección de proyecto.
// No guarda DNI, teléfonos ni domicilios.

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function alguno(texto, patrones) {
  return patrones.some((patron) => patron.test(texto));
}

function encajar(ficha) {
  const texto = normalizar([ficha.titulo, ficha.organo, ficha.texto].filter(Boolean).join('\n'));
  const aube = alguno(texto, [
    /\b(pliego|pliegos|plec|plecs)\b/,
    /\b(gobernanza|governanza|gobierno del dato|gobierno de datos|catalogo de datos|cataleg de dades)\b/,
    /\b(oficina del dato|oficina de datos|oficina de la dada|oficina tecnica)\b/,
    /\barquitectura empresarial\b/,
    /\bvideovigilancia\b[\s\S]{0,80}\bplataforma\b/,
    /\bplataforma\b[\s\S]{0,80}\bvideovigilancia\b/,
  ]);
  const pmo = /\bpmo\b|\boficina de proyectos\b|\boficina de gestion de proyectos\b/.test(texto);
  const empresas = alguno(texto, [
    /\b(mentoria|mentorias|coaching)\b/,
    /\b(formacion|formacio|curso|cursos)\b/,
    /\b(pymes|pyme|pimes|transformacion digital)\b/,
    /\b(economia circular|ecoindustria)\b/,
    /\basesoramiento\b[\s\S]{0,40}\bempresas\b/,
  ]);
  const acto = alguno(texto, [
    /\b(gala|evento|eventos|jornada|jornadas|congreso|feria|salon)\b/,
    /\b(acto institucional|actos institucionales|campana de comunicacion|comunicado de prensa|comunicados de prensa|nota de prensa)\b/,
    /\b(dinamizacion|dinamitzacio)\b/,
  ]);

  if (ficha.area === 'comunicacion') {
    return {
      vehiculo: 'alejandro',
      marca: 'Encaja con Alejandro / Tu Coach',
      motivo: 'Organización de acto o comunicación, como la Nit de la Pagesia.',
    };
  }

  if (ficha.area === 'empresa') {
    const circular = /\beconomia circular\b|\becoindustria\b/.test(texto);
    const digital = /\btransformacion digital\b|\bpymes\b|\bpyme\b/.test(texto);
    return {
      vehiculo: 'alejandro',
      marca: 'Encaja con Alejandro / Tu Coach',
      motivo: circular
        ? 'Asesoramiento a empresas, como la economía circular del Delta.'
        : digital
          ? 'Acompañamiento a empresas en transformación digital o pymes.'
          : 'Formación, coaching o acompañamiento a empresas.',
    };
  }

  if (aube && (empresas || acto)) {
    return {
      vehiculo: 'ambos',
      marca: 'Encaja con los dos',
      motivo: 'Hay plecs o gobernanza para Aube, y formación o empresas para Alejandro.',
    };
  }

  if (pmo && !aube) {
    return {
      vehiculo: 'ambos',
      marca: 'Encaja con los dos',
      motivo: 'PMO: Javier ya coordina equipos y Aube dirige proyectos TIC.',
    };
  }

  if (aube || ficha.area === 'tic' && /\b(datos|gobernanza|governanza|pliego|plec|consultoria)\b/.test(texto)) {
    const video = /\bvideovigilancia\b/.test(texto);
    return {
      vehiculo: 'aube',
      marca: 'Encaja con Aube',
      motivo: video
        ? 'Piden plataforma de videovigilancia. Aube encaja si el peso es el sistema.'
        : 'Plecs, gobernanza de datos o consultoría TIC, como el SDA del CSUC.',
    };
  }

  if (empresas || acto) {
    return {
      vehiculo: 'alejandro',
      marca: 'Encaja con Alejandro / Tu Coach',
      motivo: 'La parte que se parece a vosotros es formación, empresas o un acto.',
    };
  }

  return {
    vehiculo: 'revisar',
    marca: 'Revisar',
    motivo: 'Pasa el filtro ancho y se parece poco a las ofertas de Aube o de Alejandro.',
  };
}

function pesoEncaje(ficha) {
  const vehiculo = ficha.encaje?.vehiculo || 'revisar';
  if (vehiculo === 'revisar') return 2;
  if (vehiculo === 'ambos') return 0;
  if (ficha.area === 'tic' && vehiculo === 'aube') return 0;
  if (ficha.area !== 'tic' && vehiculo === 'alejandro') return 0;
  return 1;
}

module.exports = { encajar, pesoEncaje };
