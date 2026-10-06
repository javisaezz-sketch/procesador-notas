import { load } from 'cheerio';
import {
  recolectarUrlsImagenesPagina,
  esUrlImagenBasura,
} from '../lib/extraerImagenesEmail.js';

const baseUrl = 'https://ejemplo.com/noticia';

const ogHtml = `
<html><head>
<meta property="og:image" content="https://cdn.ejemplo.com/fotos/hero-noticia.jpg" />
<meta property="og:title" content="Titular" />
</head><body>
<img src="https://cdn.ejemplo.com/logo.png" width="120" height="40" />
<article><img src="https://cdn.ejemplo.com/fotos/cuerpo.jpg" width="900" height="600" /></article>
</body></html>`;

const $og = load(ogHtml);
const candidatasOg = recolectarUrlsImagenesPagina($og, ogHtml, baseUrl);
const okOg =
  candidatasOg[0]?.includes('hero-noticia') &&
  !candidatasOg.slice(0, 2).some((url) => url.includes('logo.png'));

const jsonLdHtml = `
<html><head>
<script type="application/ld+json">
{"@type":"NewsArticle","image":"https://cdn.ejemplo.com/jsonld/principal.webp"}
</script>
</head><body><img src="https://cdn.ejemplo.com/icon-32.png" width="32" height="32" /></body></html>`;

const $json = load(jsonLdHtml);
const candidatasJson = recolectarUrlsImagenesPagina($json, jsonLdHtml, baseUrl);
const okJson = candidatasJson[0]?.includes('jsonld/principal');

const okBasura = esUrlImagenBasura('https://track.ejemplo.com/pixel.gif');
const okLogoNoMataOg =
  !esUrlImagenBasura('https://cdn.ejemplo.com/fotos/logo-campana.jpg');

const graphHtml = `
<html><head>
<script type="application/ld+json">
{"@graph":[{"@type":"NewsArticle","image":{"@type":"ImageObject","url":"https://cdn.ejemplo.com/graph/hero.jpg"}}]}
</script>
</head><body>
<img src="https://cdn.ejemplo.com/pixel.gif" width="1" height="1" />
<img data-src="https://cdn.ejemplo.com/lazy/cuerpo.jpg" width="800" height="500" />
</body></html>`;
const candidatasGraph = recolectarUrlsImagenesPagina(load(graphHtml), graphHtml, baseUrl);
const okGraph = candidatasGraph[0]?.includes('graph/hero');
const okLazy = candidatasGraph.some((url) => url.includes('lazy/cuerpo'));

const srcsetHtml = `
<html><body><article>
<img src="https://cdn.ejemplo.com/fotos/nota-300x200.jpg"
 srcset="https://cdn.ejemplo.com/fotos/nota-300x200.jpg 300w, https://cdn.ejemplo.com/fotos/nota-1600x900.jpg 1600w" />
</article></body></html>`;
const candidatasSrc = recolectarUrlsImagenesPagina(load(srcsetHtml), srcsetHtml, baseUrl);
const okSrc =
  candidatasSrc[0]?.includes('nota-1600x900') || candidatasSrc[0]?.endsWith('/nota.jpg') || candidatasSrc.some((url) => url.endsWith('/nota.jpg') || url.includes('nota-1600x900'));

const nextHtml = `
<html><body>
<img src="/_next/image?url=https%3A%2F%2Fcdn.ejemplo.com%2Ffotos%2Foriginal.jpg&amp;w=640" />
</body></html>`;
const candidatasNext = recolectarUrlsImagenesPagina(load(nextHtml), nextHtml, baseUrl);
const okNext = candidatasNext.some((url) => url.includes('cdn.ejemplo.com/fotos/original.jpg'));

console.log('og primero:', candidatasOg[0]);
console.log('jsonld primero:', candidatasJson[0]);
console.log('graph primero:', candidatasGraph[0]);
console.log('srcset primero:', candidatasSrc[0]);
console.log('next:', candidatasNext.slice(0, 3));
console.log('OK:', okOg && okJson && okBasura && okLogoNoMataOg && okGraph && okLazy && okSrc && okNext);

if (!okOg || !okJson || !okBasura || !okLogoNoMataOg || !okGraph || !okLazy || !okSrc || !okNext) {
  process.exit(1);
}
