// Nivel de encaje con el trabajo ya presentado.
// Alto: presentaciones, mentoría, dinamización, plecs, oficina técnica y videovigilancia con plataforma.
// Medio: asesoramiento a empresas que no es mentoría.
// Bajo: el filtro ancho deja pasar un servicio informático genérico.
// No guarda DNI, teléfonos ni domicilios.

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function esMentoria(texto) {
  const mentoria = /\b(mentoria|mentorias|mentor)\b/.test(texto);
  const coaching = /\bcoaching\b/.test(texto);
  const deEmpresa = /\b(empresa|empresas|empresarial|pyme|pymes|pime|pimes|comercial|tecnolog\w*|liderazgo|directiv\w*|emprendedor\w*)\b/.test(texto);
  const liderazgo = /\bliderazgo empresarial\b|\bwomen corporate\b|\bcoaching ejecutivo\b/.test(texto);
  return (mentoria && deEmpresa) || (coaching && deEmpresa) || liderazgo;
}

function fichaEncaje(nivel, motivo) {
  const marca = nivel === 'alto' ? 'Alto' : nivel === 'medio' ? 'Medio' : 'Bajo';
  return { nivel, marca, motivo };
}

function encajar(ficha) {
  const texto = normalizar([ficha.titulo, ficha.organo, ficha.texto].filter(Boolean).join('\n'));

  if (ficha.area === 'comunicacion') {
    return fichaEncaje('alto', 'Presentación o acto, como la Nit de la Pagesia o las ferias de Vic.');
  }

  if (esMentoria(texto)) {
    const tecnologica = /\btecnolog\w*\b/.test(texto) && !/\bempresarial\b|\bgestion empresarial\b/.test(texto);
    return fichaEncaje(
      'alto',
      tecnologica ? 'Mentoría tecnológica, como el lote de Viladecans.' : 'Mentoría empresarial, con la plataforma Tu Coach.',
    );
  }

  const video = /\b(videovigilancia|cctv|circuito cerrado)\b/.test(texto) && /\bplataforma\b/.test(texto);
  if (video) return fichaEncaje('alto', 'Plataforma de videovigilancia, como el trabajo con el BIT y la Guàrdia Urbana.');
  if (/\b(pliego|pliegos|plec|plecs|oficina tecnica|oficina del dato|gobernanza|governanza|uat)\b/.test(texto)) {
    return fichaEncaje('alto', 'Plecs, oficina técnica o gobernanza de datos, como la UAT del BIT.');
  }
  if (/\bpmo\b|\boficina de proyectos\b|\boficina de gestion de proyectos\b/.test(texto)) {
    return fichaEncaje('alto', 'Oficina de proyectos o PMO.');
  }
  if (/\b(dinamizacion|dinamitzacio)\b/.test(texto)) return fichaEncaje('alto', 'Dinamización comercial, como Calella Moda.');
  if (/\b(economia circular|ecoindustria)\b/.test(texto)) {
    return fichaEncaje('medio', 'Asesoramiento a empresas en economía circular, como el Delta.');
  }
  if (/\b(transformacion digital|asesoramiento)\b/.test(texto) && /\b(empresa|empresas|pymes|pyme)\b/.test(texto)) {
    return fichaEncaje('medio', 'Acompañamiento a empresas, sin ser una mentoría.');
  }

  return fichaEncaje('bajo', 'Pasa el filtro ancho y se parece poco a las ofertas que ya habéis presentado.');
}

function pesoEncaje(ficha) {
  const nivel = ficha.encaje?.nivel;
  if (nivel === 'alto') return 0;
  if (nivel === 'medio') return 1;
  return 2;
}

module.exports = { encajar, pesoEncaje };
