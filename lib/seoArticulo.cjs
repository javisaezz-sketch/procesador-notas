const { sanitizarTituloGenerado } = require('./reglasTitulo.cjs');

const SITIOS = {
  vidaystyle: { nombre: 'Vida & Style', url: 'https://vidaystyle.com', plugin: 'aioseo' },
  femnegoci: { nombre: 'Fem Negoci', url: 'https://femnegoci.es', plugin: 'yoast' },
  glamcloset: { nombre: 'Glamcloset', url: 'https://glamcloset.cat', plugin: 'aioseo' },
  travelicius: { nombre: 'Travelicius', url: 'https://travelicius.es', plugin: null },
};

const VACIAS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o', 'u',
  'en', 'con', 'por', 'para', 'que', 'su', 'sus', 'se', 'es', 'son', 'como', 'mas', 'tras',
  'entre', 'sobre', 'sin', 'a', 'the', 'of', 'and',
]);

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function contieneFrase(texto, frase) {
  const fraseNorm = normalizar(frase);
  if (!fraseNorm) return false;
  return ` ${normalizar(texto)} `.includes(` ${fraseNorm} `);
}

function textoPlano(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ventanasConsecutivas(texto) {
  const palabras = String(texto || '').match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g) || [];
  const salidas = [];
  for (const tamano of [3, 2]) {
    for (let i = 0; i + tamano <= palabras.length; i += 1) {
      const trozo = palabras.slice(i, i + tamano);
      const contenido = trozo.filter((palabra) => {
        const limpia = normalizar(palabra);
        return limpia.length > 2 && !VACIAS.has(limpia);
      });
      if (contenido.length < 2) continue;
      salidas.push(trozo.join(' '));
    }
  }
  return salidas;
}

function derivarFrase(titulo, contenido) {
  const plano = textoPlano(contenido);
  const primer = (plano.match(/[^.!?]+[.!?]?/) || [plano])[0] || plano;
  const delTitulo = ventanasConsecutivas(titulo);
  const compartida = delTitulo.find((frase) => contieneFrase(primer, frase) || contieneFrase(plano, frase));
  if (compartida) return compartida;
  if (delTitulo[0]) return delTitulo[0];
  return ventanasConsecutivas(primer)[0] || 'nota';
}

function recortar(texto, maximo) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  if (limpio.length <= maximo) return limpio;
  const corte = limpio.slice(0, maximo).replace(/\s+\S*$/, '').trim();
  return corte || limpio.slice(0, maximo).trim();
}

function limpiarSignos(texto) {
  return String(texto || '')
    .replace(/\s+,/g, ',')
    .replace(/,+/g, ',')
    .replace(/^[,.\s—-]+|[,.\s—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tituloSeoDe(titulo, frase) {
  let base = limpiarSignos(sanitizarTituloGenerado(titulo));
  if (!contieneFrase(base, frase)) {
    base = limpiarSignos(sanitizarTituloGenerado(`${frase}, ${base}`));
  }
  if (base.length <= 58) return base;
  let corte = recortar(base, 58);
  if (!contieneFrase(corte, frase)) {
    const indice = normalizar(base).indexOf(normalizar(frase));
    corte = recortar(base.slice(Math.max(0, indice)), 58);
  }
  return limpiarSignos(corte);
}

function metaDe(contenido, frase) {
  let meta = textoPlano(contenido);
  if (!contieneFrase(meta, frase)) meta = `${frase}. ${meta}`;
  if (meta.length > 155) {
    let corte = recortar(meta, 152);
    if (!contieneFrase(corte, frase)) {
      const indice = normalizar(meta).indexOf(normalizar(frase));
      const desde = Math.max(0, indice);
      corte = recortar(meta.slice(desde), 152);
    }
    meta = /[.!?…]$/.test(corte) ? corte : `${corte}.`;
  }
  if (meta.length > 155) meta = `${recortar(meta, 154)}.`;
  return meta;
}

function escaparRegExp(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function primerParrafo(html) {
  const coincidencia = String(html).match(/<p\b[^>]*>[\s\S]*?<\/p>/i);
  return coincidencia ? coincidencia[0] : textoPlano(html).slice(0, 500);
}

function asegurarEnPrimerParrafo(html, frase) {
  if (contieneFrase(primerParrafo(html), frase)) return html;
  if (/<p\b[^>]*>/i.test(html)) {
    return html.replace(/<p\b[^>]*>/i, (apertura) => `${apertura}${frase}. `);
  }
  return `<p>${frase}.</p>${html}`;
}

function asegurarEnH2(html, frase) {
  const h2s = [...String(html).matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi)];
  if (h2s.some((coincidencia) => contieneFrase(coincidencia[0], frase))) return html;
  const primero = h2s[0];
  if (!primero) {
    return html.replace(/<\/p>/i, `</p><h2>${frase}</h2>`);
  }
  return html.replace(primero[0], primero[0].replace(/(<h2\b[^>]*>)/i, `$1${frase}, `));
}

function asegurarEnlaceInterno(html, sitio) {
  if (!sitio?.url) return html;
  let host = '';
  try {
    host = new URL(sitio.url).hostname.replace(/^www\./, '');
  } catch {
    return html;
  }
  if (new RegExp(escaparRegExp(host), 'i').test(html)) return html;
  const enlace = `<p>Publicado en <a href="${sitio.url}">${sitio.nombre}</a>.</p>`;
  if (/<\/article>/i.test(html)) {
    return html.replace(/<\/article>/i, `${enlace}</article>`);
  }
  return `${html}${enlace}`;
}

function asegurarAlt(html, frase) {
  return String(html).replace(/<img\b[^>]*>/gi, (etiqueta) => {
    if (/\balt\s*=\s*["'][^"']*["']/i.test(etiqueta) && contieneFrase(etiqueta, frase)) {
      return etiqueta;
    }
    if (/\balt\s*=/i.test(etiqueta)) {
      return etiqueta.replace(/\balt\s*=\s*["'][^"']*["']/i, `alt="${frase}"`);
    }
    return etiqueta.replace(/<img\b/i, `<img alt="${frase}"`);
  });
}

function slugDe(frase) {
  const slug = normalizar(frase).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
  return slug.slice(0, 60).replace(/-$/, '') || 'nota';
}

function prepararSeo({ titulo, contenido, slugMedio, soloCampos = false }) {
  const sitio = SITIOS[slugMedio] || null;
  const frase = derivarFrase(titulo, contenido);
  const tituloSeo = tituloSeoDe(titulo, frase);
  const meta = metaDe(contenido, frase);
  let html = String(contenido || '');
  if (!soloCampos) {
    html = asegurarEnPrimerParrafo(html, frase);
    html = asegurarEnH2(html, frase);
    html = asegurarEnlaceInterno(html, sitio);
    html = asegurarAlt(html, frase);
  }

  return {
    frase,
    tituloSeo,
    meta,
    html,
    slug: slugDe(frase),
    plugin: sitio?.plugin || null,
  };
}

function instruccionesSeo(slugMedio) {
  const sitio = SITIOS[slugMedio];
  if (!sitio) return '';
  return `
SEO DEL ARTÍCULO (OBLIGATORIO EN TODOS LOS MEDIOS):
- Elige una frase clave de 2 o 3 palabras que ya esté en el titular y que alguien buscaría.
- Esa frase clave va en el primer párrafo, en un solo <h2> y entre 2 y 3 veces en todo el texto.
- El titular tiene como máximo 58 caracteres, incluye la frase clave y no usa dos puntos.
- Hay al menos un enlace a una web oficial citada en la nota.
- Hay un enlace interno exactamente a ${sitio.url}, con el texto «${sitio.nombre}».
- El cuerpo supera las 300 palabras. No inventes datos para llegar.
`.trim();
}

module.exports = {
  SITIOS,
  prepararSeo,
  instruccionesSeo,
  contieneFrase,
};
