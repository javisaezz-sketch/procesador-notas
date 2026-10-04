function decodificar(texto) {
  return String(texto || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function etiqueta(xml, nombre) {
  const match = String(xml).match(tag(nombre));
  return match ? decodificar(match[1]) : '';
}

function todas(xml, nombre) {
  const regex = tag(nombre, 'g');
  const valores = [];
  let match = regex.exec(xml);
  while (match) {
    valores.push(decodificar(match[1]));
    match = regex.exec(xml);
  }
  return valores;
}

function bloque(xml, nombre) {
  const match = String(xml).match(tag(nombre));
  return match ? match[1] : '';
}

function bloques(xml, nombre) {
  const regex = tag(nombre, 'g');
  const valores = [];
  let match = regex.exec(xml);
  while (match) {
    valores.push(match[1]);
    match = regex.exec(xml);
  }
  return valores;
}

function tag(nombre, flags) {
  return new RegExp(
    `<(?:[\\w.-]+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${nombre}>`,
    flags,
  );
}

function cpv(codigo) {
  const digitos = String(codigo || '').replace(/\D/g, '');
  return digitos.slice(0, 8);
}

function importeDe(presupuesto) {
  const estimado = numero(etiqueta(presupuesto, 'EstimatedOverallContractAmount'));
  if (estimado != null) return estimado;
  return numero(etiqueta(presupuesto, 'TaxExclusiveAmount'));
}

function numero(valor) {
  if (!valor) return null;
  const limpio = valor.replace(/\s/g, '').replace(',', '.');
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function lugar(xml) {
  return {
    codigo: etiqueta(xml, 'CountrySubentityCode'),
    nombre: etiqueta(xml, 'CountrySubentity') || etiqueta(xml, 'CityName'),
  };
}

function listarEntradas(xml) {
  const entradas = [];
  const regex = /<entry\b[\s\S]*?<\/entry>/g;
  let match = regex.exec(xml);
  while (match) {
    entradas.push(match[0]);
    match = regex.exec(xml);
  }
  return entradas;
}

function enlaceNext(xml) {
  const cabecera = String(xml).split('<entry')[0];
  const links = cabecera.match(/<link\b[^>]*>/g) || [];
  for (const link of links) {
    if (!/\brel="next"/.test(link)) continue;
    const href = link.match(/\bhref="([^"]+)"/);
    if (href) return decodificar(href[1]);
  }
  return '';
}

function epochActualizado(entryXml) {
  const updated = etiqueta(entryXml, 'updated');
  const epoch = Date.parse(updated);
  return Number.isNaN(epoch) ? 0 : epoch;
}

function parsearEntrada(entryXml) {
  const proyecto = bloque(entryXml, 'ProcurementProject');
  const organoXml = bloque(entryXml, 'LocatedContractingParty');
  const plazoXml = bloque(entryXml, 'TenderSubmissionDeadlinePeriod');
  const titulo = etiqueta(entryXml, 'title') || etiqueta(proyecto, 'Name');
  const expediente = etiqueta(entryXml, 'ContractFolderID');
  const nif = (organoXml.match(/schemeName="NIF"[^>]*>([^<]+)/) || [])[1] || '';
  const nombreOrgano = etiqueta(organoXml, 'Name');
  const ciudad = etiqueta(bloque(organoXml, 'PostalAddress'), 'CityName');
  const descripcion = etiqueta(proyecto, 'Description').slice(0, 2000);
  const fechas = [];
  const avisos = /<(?:[\w.-]+:)?NoticeTypeCode[^>]*>\s*DOC_CN\s*<\/(?:[\w.-]+:)?NoticeTypeCode>([\s\S]{0,600}?)<(?:[\w.-]+:)?IssueDate>([^<]+)/g;
  let aviso = avisos.exec(entryXml);
  while (aviso) {
    fechas.push(aviso[2].trim().slice(0, 10));
    aviso = avisos.exec(entryXml);
  }
  const enlace = decodificar((entryXml.match(/<link\b[^>]*\bhref="([^"]+)"/) || [])[1] || '');
  const fecha = etiqueta(plazoXml, 'EndDate').slice(0, 10);
  const hora = etiqueta(plazoXml, 'EndTime').slice(0, 8) || '23:59:59';
  const organoVisible = ciudad && !normalizarIncluye(nombreOrgano, ciudad) ? `${nombreOrgano} · ${ciudad}` : nombreOrgano;

  return {
    clave: `${(nif || nombreOrgano || 'organo').trim()}::${(expediente || etiqueta(entryXml, 'id')).trim()}`,
    titulo,
    organo: organoVisible,
    importe: importeDe(bloque(proyecto, 'BudgetAmount')),
    enlace,
    publicacion: fechas.sort()[0] || '',
    tope: fecha ? `${fecha}T${hora}` : '',
    cpvs: todas(proyecto, 'ItemClassificationCode').map(cpv).filter(Boolean),
    tipo: etiqueta(proyecto, 'TypeCode'),
    estado: etiqueta(entryXml, 'ContractFolderStatusCode'),
    lugares: bloques(proyecto, 'RealizedLocation').map(lugar).filter((sitio) => sitio.codigo || sitio.nombre),
    organoLugar: lugar(bloque(organoXml, 'PostalAddress')),
    texto: [titulo, etiqueta(proyecto, 'Name'), descripcion].filter(Boolean).join('\n'),
    actualizadoEpoch: epochActualizado(entryXml),
  };
}

function normalizarIncluye(nombre, ciudad) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .includes(
      String(ciudad || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase(),
    );
}

module.exports = {
  decodificar,
  listarEntradas,
  enlaceNext,
  epochActualizado,
  parsearEntrada,
};
