// Con qué sociedad presentarse.
// Presentaciones de menos de 10.000 € y mentorías empresariales: Alejandro / Tu Coach.
// Presentaciones desde 10.000 €, y todo lo demás: Aube.
// No guarda DNI, teléfonos ni domicilios.

const CORTE_PRESENTACION = 10000;

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function esMentoriaEmpresarial(texto) {
  const mentoria = /\b(mentoria|mentorias|mentor)\b/.test(texto);
  const coachingEmpresarial = /\bcoaching\b/.test(texto) && /\b(empresa|empresas|empresarial|pyme|pymes|pime|pimes)\b/.test(texto);
  const deEmpresa = /\b(empresa|empresas|empresarial|pyme|pymes|pime|pimes|comercial)\b/.test(texto);
  return (mentoria && deEmpresa) || coachingEmpresarial;
}

function encajar(ficha) {
  const texto = normalizar([ficha.titulo, ficha.organo, ficha.texto].filter(Boolean).join('\n'));
  const importe = Number(ficha.importe);

  if (ficha.area === 'comunicacion') {
    if (Number.isFinite(importe) && importe < CORTE_PRESENTACION) {
      return {
        vehiculo: 'alejandro',
        marca: 'Encaja con Alejandro / Tu Coach',
        motivo: 'Presentación de menos de 10.000 €.',
      };
    }
    return {
      vehiculo: 'aube',
      marca: 'Encaja con Aube',
      motivo: 'Presentación de 10.000 € o más.',
    };
  }

  if (esMentoriaEmpresarial(texto)) {
    return {
      vehiculo: 'alejandro',
      marca: 'Encaja con Alejandro / Tu Coach',
      motivo: 'Mentoría empresarial.',
    };
  }

  return {
    vehiculo: 'aube',
    marca: 'Encaja con Aube',
    motivo: 'El resto de ofertas se presenta con Aube.',
  };
}

function pesoEncaje(ficha) {
  return ficha.encaje?.vehiculo === 'alejandro' ? 0 : 1;
}

module.exports = { encajar, pesoEncaje, CORTE_PRESENTACION };
