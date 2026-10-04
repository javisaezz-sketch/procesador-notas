const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluar } = require('./perfil.cjs');
const { parsearEntrada, listarEntradas, enlaceNext } = require('./parsear.cjs');
const { recorrerFeed } = require('./fuentes.cjs');
const { construirMensaje } = require('./correo.cjs');

const AHORA = '2026-10-04T12:00:00';

function base(extra = {}) {
  return {
    clave: 'P123::EXP-1',
    titulo: 'Dirección técnica de la gala institucional',
    organo: 'Ayuntamiento de Gavà',
    importe: 8500,
    enlace: 'https://contrataciondelestado.es/ejemplo',
    publicacion: '2026-10-01',
    tope: '2026-10-20T14:00:00',
    cpvs: ['79952000'],
    tipo: '2',
    estado: 'PUB',
    lugares: [{ codigo: 'ES511', nombre: 'Barcelona' }],
    organoLugar: { codigo: 'ES511', nombre: 'Gavà' },
    texto: 'Dirección técnica de la gala institucional',
    actualizadoEpoch: 1,
    ...extra,
  };
}

test('guarda una gala en plazo dentro de territorio y por encima de 7000', () => {
  const decision = evaluar(base(), AHORA);
  assert.equal(decision.ok, true);
  assert.equal(decision.ficha.area, 'comunicacion');
  assert.equal(decision.ficha.importe, 8500);
});

test('acepta el mínimo de 7000 y rechaza lo que queda por debajo', () => {
  assert.equal(evaluar(base({ importe: 7000, texto: 'Organización de eventos institucionales', titulo: 'Organización de eventos institucionales' }), AHORA).ok, true);
  assert.equal(evaluar(base({ importe: 6999 }), AHORA).motivo, 'importe');
});

test('deja fuera plazo vencido, estado cerrado, otro tipo y otro territorio', () => {
  assert.equal(evaluar(base({ tope: '2026-10-04T11:00:00' }), AHORA).motivo, 'plazo');
  assert.equal(evaluar(base({ estado: 'ADJ' }), AHORA).motivo, 'estado');
  assert.equal(evaluar(base({ tipo: '1' }), AHORA).motivo, 'tipo');
  assert.equal(
    evaluar(base({ lugares: [{ codigo: 'ES432', nombre: 'Cáceres' }], organoLugar: { codigo: 'ES432', nombre: 'Cáceres' } }), AHORA).motivo,
    'territorio',
  );
});

test('si el trabajo se ejecuta fuera, no basta con que el órgano esté en Madrid', () => {
  const decision = evaluar(
    base({
      lugares: [{ codigo: 'ES432', nombre: 'Cáceres' }],
      organoLugar: { codigo: 'ES300', nombre: 'Madrid' },
    }),
    AHORA,
  );
  assert.equal(decision.motivo, 'territorio');
});

test('un órgano en Madrid que ejecuta en el extranjero no entra', () => {
  const decision = evaluar(
    base({
      lugares: [],
      organoLugar: { codigo: '', nombre: 'Madrid' },
      titulo: 'Observatorio en Uruguay',
      texto: 'Apoyo a los poderes públicos de Uruguay',
      cpvs: ['72322000'],
    }),
    AHORA,
  );
  assert.equal(decision.motivo, 'territorio');
});

test('sin lugar de ejecución usa la sede del órgano', () => {
  const decision = evaluar(
    base({
      lugares: [],
      organoLugar: { codigo: 'ES300', nombre: 'Madrid' },
      titulo: 'Campaña de comunicación institucional',
      texto: 'Campaña de comunicación institucional',
    }),
    AHORA,
  );
  assert.equal(decision.ok, true);
});

test('quita catering y alquiler de carpa, escenario o sala', () => {
  assert.equal(evaluar(base({ texto: 'Servicio de catering para la gala', titulo: 'Servicio de catering para la gala' }), AHORA).motivo, 'catering');
  assert.equal(
    evaluar(base({ texto: 'Gala institucional con alquiler de escenario y sonido', titulo: 'Gala con alquiler de escenario' }), AHORA).motivo,
    'alquiler',
  );
});

test('el alquiler de software de la oficina del dato no es un alquiler grande', () => {
  const decision = evaluar(
    base({
      cpvs: ['72316000'],
      titulo: 'Oficina del dato',
      texto: 'Alquiler de licencias de software para la oficina del dato',
    }),
    AHORA,
  );
  assert.equal(decision.ok, true);
  assert.equal(decision.ficha.area, 'tic');
});

test('la videovigilancia entra con plataforma y sale si solo son cámaras', () => {
  const plataforma = evaluar(
    base({
      cpvs: ['72000000'],
      titulo: 'Plataforma de videovigilancia en la nube',
      texto: 'Plataforma de videovigilancia en la nube con analítica',
    }),
    AHORA,
  );
  assert.equal(plataforma.ok, true);
  assert.equal(plataforma.ficha.area, 'videovigilancia');
  assert.equal(
    evaluar(base({
      titulo: 'Instalación de cámaras de videovigilancia',
      texto: 'Instalación de cámaras de videovigilancia en el casco urbano',
      cpvs: ['35125300'],
    }), AHORA).motivo,
    'camaras',
  );
});

test('no confunde el protocolo informático ni el Congreso de los Diputados con un acto', () => {
  assert.equal(
    evaluar(base({
      titulo: 'Intercambio de ficheros por protocolo Edifact',
      texto: 'Sistema de transferencia de ficheros basado en el protocolo Edifact',
      cpvs: ['72260000'],
    }), AHORA).motivo,
    'tema',
  );
  assert.equal(
    evaluar(base({
      titulo: 'Servicios de fotografía para el Congreso de los Diputados',
      texto: 'Servicios de fotografía para el Congreso de los Diputados',
      cpvs: ['79961000'],
    }), AHORA).motivo,
    'tema',
  );
});

test('un congreso entra si el CPV es de eventos; la atención al pasajero no', () => {
  assert.equal(
    evaluar(base({
      titulo: 'Organización del I Congreso de Turismo Rural',
      texto: 'Producción y organización del I Congreso de Turismo Rural',
      cpvs: ['79952000'],
    }), AHORA).ficha.area,
    'comunicacion',
  );
  assert.equal(
    evaluar(base({
      titulo: 'Información y atención a pasajeros en el aeropuerto',
      texto: 'Servicio de información y atención a pasajeros y usuarios',
      cpvs: ['79341000'],
    }), AHORA).motivo,
    'tema',
  );
});

test('separa mentoría y dinamización comercial', () => {
  assert.equal(
    evaluar(base({ cpvs: [], titulo: 'Programa de mentoría comercial', texto: 'Programa de mentoría para comercios' }), AHORA).ficha.area,
    'mentoria',
  );
  assert.equal(
    evaluar(
      base({
        cpvs: [],
        titulo: 'Dinamización comercial del centro',
        texto: 'Dinamización comercial con asociaciones de comerciantes',
      }),
      AHORA,
    ).ficha.area,
    'dinamizacion',
  );
});

test('lee importe, plazo, territorio y enlace de un anuncio CODICE', () => {
  const xml = `
    <entry>
      <title>Campaña de comunicación institucional</title>
      <link href="https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&amp;idEvl=abc"/>
      <updated>2026-10-03T18:36:47.161+02:00</updated>
      <summary>Estado: PUB</summary>
      <cac-place-ext:ContractFolderStatus>
        <cbc:ContractFolderID>COM-2026-1</cbc:ContractFolderID>
        <cbc-place-ext:ContractFolderStatusCode>PUB</cbc-place-ext:ContractFolderStatusCode>
        <cac-place-ext:LocatedContractingParty>
          <cac:Party>
            <cac:PartyIdentification><cbc:ID schemeName="NIF">P0800000A</cbc:ID></cac:PartyIdentification>
            <cac:PartyName><cbc:Name>Ayuntamiento de Gavà</cbc:Name></cac:PartyName>
            <cac:PostalAddress>
              <cbc:CityName>Gavà</cbc:CityName>
              <cbc:CountrySubentity>Barcelona</cbc:CountrySubentity>
              <cbc:CountrySubentityCode>ES511</cbc:CountrySubentityCode>
            </cac:PostalAddress>
          </cac:Party>
        </cac-place-ext:LocatedContractingParty>
        <cac:ProcurementProject>
          <cbc:Name>Campaña de comunicación institucional</cbc:Name>
          <cbc:TypeCode>2</cbc:TypeCode>
          <cac:BudgetAmount>
            <cbc:EstimatedOverallContractAmount currencyID="EUR">12500.4</cbc:EstimatedOverallContractAmount>
            <cbc:TotalAmount currencyID="EUR">15125</cbc:TotalAmount>
          </cac:BudgetAmount>
          <cac:RequiredCommodityClassification>
            <cbc:ItemClassificationCode>79341000</cbc:ItemClassificationCode>
          </cac:RequiredCommodityClassification>
          <cac:RealizedLocation>
            <cbc:CountrySubentity>Barcelona</cbc:CountrySubentity>
            <cbc:CountrySubentityCode>ES511</cbc:CountrySubentityCode>
          </cac:RealizedLocation>
        </cac:ProcurementProject>
        <cac:TenderingProcess>
          <cac:TenderSubmissionDeadlinePeriod>
            <cbc:EndDate>2026-10-20</cbc:EndDate>
            <cbc:EndTime>14:00:00</cbc:EndTime>
          </cac:TenderSubmissionDeadlinePeriod>
        </cac:TenderingProcess>
        <cac-place-ext:ValidNoticeInfo>
          <cbc-place-ext:NoticeTypeCode>DOC_CN</cbc-place-ext:NoticeTypeCode>
          <cbc:IssueDate>2026-10-01</cbc:IssueDate>
        </cac-place-ext:ValidNoticeInfo>
      </cac-place-ext:ContractFolderStatus>
    </entry>`;
  const item = parsearEntrada(xml);
  assert.equal(item.importe, 12500.4);
  assert.equal(item.tope, '2026-10-20T14:00:00');
  assert.equal(item.publicacion, '2026-10-01');
  assert.equal(item.enlace, 'https://contrataciondelestado.es/wps/poc?uri=deeplink:detalle_licitacion&idEvl=abc');
  assert.equal(item.estado, 'PUB');
  assert.equal(item.tipo, '2');
  const decision = evaluar(item, AHORA);
  assert.equal(decision.ok, true);
  assert.equal(decision.ficha.area, 'comunicacion');
});

test('el recorrido para cuando la página ya es anterior a la fecha de corte', async () => {
  const pagina = (titulo, next) => `
    <feed>
      <link href="${next}" rel="next"/>
      <entry><title>${titulo}</title><updated>2026-10-04T10:00:00+02:00</updated></entry>
    </feed>`;
  const paginas = {
    'https://ejemplo/1': pagina('una', 'https://ejemplo/2'),
    'https://ejemplo/2': `
      <feed>
        <entry><title>vieja</title><updated>2026-09-01T10:00:00+02:00</updated></entry>
      </feed>`,
  };
  const vistas = [];
  const resultado = await recorrerFeed({
    urlInicial: 'https://ejemplo/1',
    desdeEpoch: Date.parse('2026-10-01T00:00:00Z'),
    maxPaginas: 5,
    bajar: async (url) => paginas[url],
    onEntry: async (xml) => vistas.push(listarEntradas(xml)[0]),
  });
  assert.equal(resultado.paginas, 2);
  assert.equal(vistas.length, 1);
  assert.equal(enlaceNext(paginas['https://ejemplo/1']), 'https://ejemplo/2');
});

test('el correo agrupa por área y ordena por fecha tope', () => {
  const mensaje = construirMensaje({
    fechaTexto: '4 de octubre de 2026',
    nuevas: new Set(['B::2']),
    resumenFuentes: 'Perfiles: 1 página',
    licitaciones: [
      {
        clave: 'A::1',
        area: 'tic',
        etiqueta: 'TIC, datos y PMO',
        titulo: 'Oficina del dato',
        organo: 'Ayuntamiento de Zaragoza',
        importe: 20000,
        publicacion: '2026-09-28',
        tope: '2026-10-18T12:00:00',
        enlace: 'https://ejemplo/dato',
        tambien: [],
      },
      {
        clave: 'B::2',
        area: 'comunicacion',
        etiqueta: 'Comunicación y eventos',
        titulo: 'Gala de Navidad',
        organo: 'Ayuntamiento de Madrid',
        importe: 9000,
        publicacion: '2026-10-02',
        tope: '2026-10-22T14:00:00',
        enlace: 'https://ejemplo/gala',
        tambien: [],
      },
      {
        clave: 'C::3',
        area: 'comunicacion',
        etiqueta: 'Comunicación y eventos',
        titulo: 'Congreso de comercio',
        organo: 'Ayuntamiento de Huesca',
        importe: 15000,
        publicacion: '2026-10-01',
        tope: '2026-10-15T09:00:00',
        enlace: 'https://ejemplo/congreso',
        tambien: [{ etiqueta: 'Dinamización comercial' }],
      },
    ],
  });
  const comunicacion = mensaje.texto.indexOf('Comunicación y eventos');
  const tic = mensaje.texto.indexOf('TIC, datos y PMO');
  const congreso = mensaje.texto.indexOf('Congreso de comercio');
  const gala = mensaje.texto.indexOf('Gala de Navidad');
  assert.ok(comunicacion < tic);
  assert.ok(congreso < gala);
  assert.match(mensaje.texto, /9\.000\s*€/);
  assert.match(mensaje.texto, /Publicación 02\/10\/2026/);
  assert.match(mensaje.texto, /Tope 22\/10\/2026 14:00/);
  assert.match(mensaje.texto, /https:\/\/ejemplo\/gala/);
  assert.match(mensaje.asunto, /3$/);
  assert.match(mensaje.html, /Nueva/);
});
