import assert from 'assert';
import {
  contenidoEsSimilar,
  contenidoTieneUrl,
  urlAptaParaDuplicado,
} from '../lib/detectarDuplicadoNota.js';

const cabecera = '---------- forwarded message --------- de: noe naves <noenavessl@gmail.com> date: lun, 5 oct 2026 a las 11:19 ';
const lidl = `${cabecera}https://www.marketingdirecto.com/creacion/campanas-de-marketing/lidl-lanza-exquisita-almohadaviaje-forma-croissant-hara-boca-agua`;
const nespresso = `${cabecera}https://www.reasonwhy.es/actualidad/nespresso-swarovski-unen-cafe-joyas-coleccion-navidad-2026-edicion`;

assert.strictEqual(contenidoEsSimilar(lidl, nespresso), false);
assert.strictEqual(contenidoEsSimilar(lidl, lidl), true);
assert.strictEqual(contenidoEsSimilar('hola', 'hola'), true);

assert.strictEqual(urlAptaParaDuplicado('https://www.instagram.com/laglamdelbuenvivir'), false);
assert.strictEqual(urlAptaParaDuplicado('https://vidaystyle.com/noticias'), false);
assert.strictEqual(urlAptaParaDuplicado('https://cdn.ejemplo.com/fotos/image.png'), false);
assert.strictEqual(
  urlAptaParaDuplicado('https://www.marketingdirecto.com/creacion/campanas-de-marketing/lidl-lanza-exquisita-almohadaviaje-forma-croissant-hara-boca-agua'),
  true,
);

const notaVieja = 'La firma habla de noticias, contacto y laglamdelbuenvivir en el pie.';
const urlLidl = 'https://www.marketingdirecto.com/creacion/campanas-de-marketing/lidl-lanza-exquisita-almohadaviaje-forma-croissant-hara-boca-agua';
assert.strictEqual(contenidoTieneUrl(notaVieja, urlLidl), false);
assert.strictEqual(contenidoTieneUrl(`Mira ${urlLidl}`, urlLidl), true);

console.log('OK');
