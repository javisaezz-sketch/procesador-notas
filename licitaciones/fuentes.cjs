const https = require('https');
const { URL } = require('url');

const { listarEntradas, enlaceNext, epochActualizado } = require('./parsear.cjs');

const FUENTES = [
  {
    id: 'perfiles',
    nombre: 'Perfiles en la plataforma estatal',
    url: 'https://contrataciondelestado.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom',
  },
  {
    id: 'agregadas',
    nombre: 'Plataformas autonómicas agregadas',
    url: 'https://contrataciondelestado.es/sindicacion/sindicacion_1044/PlataformasAgregadasSinMenores.atom',
  },
];

function descargar(url, hops = 4) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'saez-naves-licitaciones/0.1',
          Accept: 'application/atom+xml, application/xml, text/xml, */*',
        },
        timeout: 120000,
      },
      (res) => {
        const codigo = res.statusCode || 0;
        if (codigo >= 300 && codigo < 400 && res.headers.location) {
          res.resume();
          if (hops <= 0) {
            reject(new Error(`Demasiadas redirecciones en ${url}`));
            return;
          }
          resolve(descargar(new URL(res.headers.location, url).href, hops - 1));
          return;
        }
        if (codigo !== 200) {
          res.resume();
          reject(new Error(`HTTP ${codigo} al leer ${url}`));
          return;
        }
        const trozos = [];
        res.on('data', (trozo) => trozos.push(trozo));
        res.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
      },
    );
    req.on('timeout', () => req.destroy(new Error(`Tiempo agotado al leer ${url}`)));
    req.on('error', reject);
  });
}

async function descargarConReintento(url) {
  try {
    return await descargar(url);
  } catch (error) {
    return descargar(url);
  }
}

async function recorrerFeed({ urlInicial, desdeEpoch, maxPaginas, bajar, onEntry }) {
  let url = urlInicial;
  let paginas = 0;
  let entradas = 0;
  while (url && paginas < maxPaginas) {
    const xml = await bajar(url);
    paginas += 1;
    const lote = listarEntradas(xml).sort((a, b) => epochActualizado(b) - epochActualizado(a));
    let minimo = Infinity;
    for (const entrada of lote) {
      const epoch = epochActualizado(entrada);
      if (epoch) minimo = Math.min(minimo, epoch);
      if (epoch && epoch < desdeEpoch) continue;
      entradas += 1;
      await onEntry(entrada);
    }
    if (!lote.length || minimo < desdeEpoch) break;
    url = enlaceNext(xml);
  }
  return { paginas, entradas };
}

module.exports = {
  FUENTES,
  descargar,
  descargarConReintento,
  recorrerFeed,
};
