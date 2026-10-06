import sharp from 'sharp';

// Instagram publica entre 4:5 y 1.91:1. Fuera de eso recorta la foto.
const RATIO_MIN = 4 / 5;
const RATIO_MAX = 1.91;
// 1440 px es el ancho máximo que Instagram conserva antes de volver a comprimir.
const ANCHO_MAX = 1440;

function dentroDeInstagram(ratio) {
  return ratio >= RATIO_MIN - 0.005 && ratio <= RATIO_MAX + 0.005;
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
 * Deja la foto entera dentro de un marco que Instagram no recorta.
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

  if (dentroDeInstagram(ratio)) {
    const ancho = Math.min(ANCHO_MAX, width);
    return aJpeg(
      sharp(input, { failOn: 'none' }).rotate().resize({
        width: ancho,
        withoutEnlargement: true,
        fit: 'inside',
      }),
    );
  }

  const ratioMarco = ratio < RATIO_MIN ? RATIO_MIN : RATIO_MAX;
  const marcoAncho = Math.min(ANCHO_MAX, Math.max(width, 320));
  const marcoAlto = Math.max(1, Math.round(marcoAncho / ratioMarco));

  const fondo = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize(marcoAncho, marcoAlto, { fit: 'cover' })
    .blur(24)
    .modulate({ brightness: 0.9 })
    .toBuffer();

  const foto = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize(marcoAncho, marcoAlto, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  return aJpeg(
    sharp(fondo).composite([{ input: foto, gravity: 'centre' }]),
  );
}
