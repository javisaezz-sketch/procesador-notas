import sharp from 'sharp';

// Instagram rechaza el contenedor si el ratio cae fuera de 4:5 y 1.91:1.
const RATIO_MIN = 4 / 5;
const RATIO_MAX = 1.91;
// Un poco por dentro: el redondeo de píxeles no puede salir del rango.
const RATIO_MIN_SEGURO = 0.81;
const RATIO_MAX_SEGURO = 1.9;
// 1440 px es el ancho máximo que Instagram conserva antes de volver a comprimir.
const ANCHO_MAX = 1440;

export function cabeEnFormatoInstagram(width, height) {
  if (!width || !height) return false;
  const ratio = width / height;
  return ratio >= RATIO_MIN && ratio <= RATIO_MAX;
}

function dentroDeInstagram(ratio) {
  return ratio >= RATIO_MIN && ratio <= RATIO_MAX;
}

function yaCabeConMargen(ratio) {
  return ratio >= RATIO_MIN_SEGURO && ratio <= RATIO_MAX_SEGURO;
}

function marcoSeguro(anchoBase, ratioObjetivo) {
  const ancho = Math.min(ANCHO_MAX, Math.max(320, Math.round(anchoBase)));
  let alto = Math.max(1, Math.round(ancho / ratioObjetivo));
  let ratio = ancho / alto;

  for (let i = 0; i < 12 && !dentroDeInstagram(ratio); i += 1) {
    alto += ratio > RATIO_MAX ? 1 : -1;
    if (alto < 1) {
      alto = 1;
      break;
    }
    ratio = ancho / alto;
  }

  return { ancho, alto };
}

async function aJpeg(pipeline) {
  return pipeline
    .jpeg({
      quality: 92,
      mozjpeg: true,
      chromaSubsampling: '4:4:4',
    })
    .toBuffer();
}

/**
 * Deja la foto entera dentro de un marco que Instagram acepta (4:5 a 1.91:1).
 * Si ya entra en el formato, solo se escala. Si es más alta o más ancha,
 * se centra sobre un fondo desenfocado de la misma imagen.
 */
export async function encajarFotoInstagram(input) {
  const base = sharp(input, { failOn: 'none' }).rotate();
  const meta = await base.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  if (!width || !height) {
    return aJpeg(sharp(input, { failOn: 'none' }).rotate());
  }

  const ratio = width / height;

  if (yaCabeConMargen(ratio)) {
    const ancho = Math.min(ANCHO_MAX, width);
    const jpeg = await aJpeg(
      sharp(input, { failOn: 'none' }).rotate().resize({
        width: ancho,
        withoutEnlargement: true,
        fit: 'inside',
      }),
    );
    return exigirFormatoInstagram(jpeg);
  }

  const ratioMarco = ratio < RATIO_MIN_SEGURO ? RATIO_MIN_SEGURO : RATIO_MAX_SEGURO;
  const { ancho: marcoAncho, alto: marcoAlto } = marcoSeguro(
    Math.max(width, 320),
    ratioMarco,
  );

  const fondo = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize(marcoAncho, marcoAlto, { fit: 'cover' })
    .blur(24)
    .modulate({ brightness: 0.9 })
    .toBuffer();

  const foto = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize(marcoAncho, marcoAlto, { fit: 'inside' })
    .toBuffer();

  const jpeg = await aJpeg(
    sharp(fondo).composite([{ input: foto, gravity: 'centre' }]),
  );
  return exigirFormatoInstagram(jpeg);
}

async function exigirFormatoInstagram(jpeg) {
  const meta = await sharp(jpeg, { failOn: 'none' }).metadata();
  if (!cabeEnFormatoInstagram(meta.width, meta.height)) {
    throw new Error(
      `la foto sigue fuera de formato (${meta.width || 0}×${meta.height || 0})`,
    );
  }
  return jpeg;
}
