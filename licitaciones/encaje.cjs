// Con qué sociedad presentarse, a partir de las ofertas ya presentadas.
// Alejandro / Tu Coach: presentaciones de menos de 10.000 € y mentorías empresariales o tecnológicas.
// Aube: presentaciones desde 10.000 €, dinamización, plecs, oficina técnica y videovigilancia con plataforma.
// No guarda DNI, teléfonos ni domicilios.

const CORTE_PRESENTACION = 10000;

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

function motivoAube(texto) {
  const video = /\b(videovigilancia|cctv|circuito cerrado)\b/.test(texto) && /\bplataforma\b/.test(texto);
  if (video) return 'Plataforma de videovigilancia, como el trabajo con el BIT y la Guàrdia Urbana.';
  if (/\b(pliego|pliegos|plec|plecs|oficina tecnica|oficina del dato|gobernanza|governanza|uat)\b/.test(texto)) {
    return 'Plecs, oficina técnica o gobernanza de datos, como la UAT del BIT.';
  }
  if (/\b(dinamizacion|dinamitzacio)\b/.test(texto)) return 'Dinamización comercial, como Calella Moda.';
  if (/\b(feria|fires|comunicacion|campana)\b/.test(texto)) return 'Comunicación o feria, como Vic Fires.';
  return 'Se presenta con Aube.';
}

function encajar(ficha) {
  const texto = normalizar([ficha.titulo, ficha.organo, ficha.texto].filter(Boolean).join('\n'));
  const importe = Number(ficha.importe);

  if (ficha.area === 'comunicacion') {
    if (Number.isFinite(importe) && importe < CORTE_PRESENTACION) {
      return {
        vehiculo: 'alejandro',
        marca: 'Encaja con Alejandro / Tu Coach',
        motivo: 'Presentación de menos de 10.000 €, como la Nit de la Pagesia.',
      };
    }
    return {
      vehiculo: 'aube',
      marca: 'Encaja con Aube',
      motivo: 'Presentación de 10.000 € o más, como las ferias de Vic.',
    };
  }

  if (esMentoria(texto)) {
    const tecnologica = /\bmentoria tecnolog\w*\b|\btecnolog\w*\b/.test(texto) && /\b(mentoria|mentor|coaching)\b/.test(texto);
    return {
      vehiculo: 'alejandro',
      marca: 'Encaja con Alejandro / Tu Coach',
      motivo: tecnologica && !/\bempresarial\b|\bgestion empresarial\b/.test(texto)
        ? 'Mentoría tecnológica, como el lote de Viladecans.'
        : 'Mentoría empresarial, con la plataforma Tu Coach.',
    };
  }

  return {
    vehiculo: 'aube',
    marca: 'Encaja con Aube',
    motivo: motivoAube(texto),
  };
}

function pesoEncaje(ficha) {
  return ficha.encaje?.vehiculo === 'alejandro' ? 0 : 1;
}

module.exports = { encajar, pesoEncaje, CORTE_PRESENTACION };
