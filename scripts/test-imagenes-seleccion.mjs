import {
  prepararContenidoConImagenesSeleccionadas,
  quitarImagenesGaleria,
} from '../lib/contenidoHtml.js';

const html = `<article>
<p>Parrafo 1</p>
<h2>Seccion</h2>
<p>Parrafo 2</p>
<figure class="wp-block-image size-large"><img src="https://glamcloset.cat/wp-content/uploads/2026/08/cuerpo-1787647530446.png" alt="x"/></figure>
<p>Parrafo 3</p>
<figure class="wp-block-image size-large"><img src="https://travelicius.es/wp-content/uploads/2026/08/cuerpo-1787647537455.png" alt="x"/></figure>
<p>Fin</p>
</article>
<section class="galeria-nota"><figure class="imagen-galeria"><img src="https://femnegoci.es/wp-content/uploads/x.png" alt="galeria"/></figure></section>
<figure class="wp-block-image size-large"><img src="https://vidaystyle.com/wp-content/uploads/2026/08/cuerpo-1787647541909.png" alt="x"/></figure>`;

const seleccionadas = [
  'https://example.supabase.co/storage/v1/object/public/notas-prensa/nota/a.png',
];

const htmlConGaleriaWp = `<article><p>Texto</p></article>
<figure class="wp-block-gallery"><ul class="blocks-gallery-grid"><li><img src="https://x.com/1.jpg"/></li></ul></figure>`;

let c = prepararContenidoConImagenesSeleccionadas(html, seleccionadas, 'Titulo');
let c2 = quitarImagenesGaleria(htmlConGaleriaWp);

const imgs = (c.match(/<img/gi) || []).length;
const fuera =
  c.includes('1787647541909') ||
  c.includes('1787647537455') ||
  c.includes('galeria-nota') ||
  c.includes('femnegoci.es');
const despuesArticle = /<\/article>[\s\S]*<img/i.test(c);
const sinGaleriaWp = !c2.includes('wp-block-gallery');

console.log('imgs:', imgs);
console.log('unselected/galeria present:', fuera);
console.log('img after article:', despuesArticle);
console.log('wp-block-gallery stripped:', sinGaleriaWp);
console.log(
  'OK:',
  imgs <= 1 && !fuera && !despuesArticle && sinGaleriaWp,
);

if (imgs > 1 || fuera || despuesArticle || !sinGaleriaWp) {
  process.exit(1);
}
