import {
  mismaImagenStorage,
  resolverUrlsSeleccionadas,
  resolverUrlDestacada,
  urlsImagenesCuerpo,
  canonicalizarUrlImagen,
} from '../lib/limpiarAlmacenNota.js';

const base =
  'https://example.supabase.co/storage/v1/object/public/notas-prensa/nota/1';
const disponibles = [
  `${base}/a.jpg`,
  `${base}/b.jpg`,
  `${base}/c.jpg`,
];
const firmadaB = `${base.replace('/public/', '/sign/')}/b.jpg?token=abc`;

const seleccionadas = resolverUrlsSeleccionadas(
  [disponibles[0], firmadaB, disponibles[2]],
  disponibles,
);

const destacada = resolverUrlDestacada(firmadaB, seleccionadas, disponibles);
const cuerpo = urlsImagenesCuerpo(seleccionadas, destacada);

const okDestacada = mismaImagenStorage(destacada, disponibles[1]);
const okCuerpo =
  cuerpo.length === 2 &&
  !cuerpo.some((url) => mismaImagenStorage(url, destacada));

const sinCatalogo = resolverUrlsSeleccionadas([firmadaB], []);
const okSinCatalogo =
  sinCatalogo.length === 1 &&
  resolverUrlDestacada(firmadaB, sinCatalogo, []) === firmadaB;

const soloDestacadaLegacy =
  canonicalizarUrlImagen(firmadaB, disponibles) ?? firmadaB;
const okSoloDestacada =
  Boolean(soloDestacadaLegacy) &&
  mismaImagenStorage(soloDestacadaLegacy, disponibles[1]);

console.log('destacada:', destacada);
console.log('cuerpo:', cuerpo);
console.log('OK:', okDestacada && okCuerpo && okSinCatalogo && okSoloDestacada);

if (!okDestacada || !okCuerpo || !okSinCatalogo || !okSoloDestacada) {
  process.exit(1);
}
