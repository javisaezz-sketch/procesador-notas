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

const okBasura = esUrlImagenBasura('https://cdn.ejemplo.com/logo-site.png');

console.log('og primero:', candidatasOg[0]);
console.log('jsonld primero:', candidatasJson[0]);
console.log('OK:', okOg && okJson && okBasura);

if (!okOg || !okJson || !okBasura) {
  process.exit(1);
}
