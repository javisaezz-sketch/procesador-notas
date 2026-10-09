import sharp from 'sharp';

const LADO_LARGO_MIN = 900;
const LADO_CORTO_MIN = 600;
const NITIDEZ_MIN = 40;
// Por debajo de esto, estirar no se nota. Más allá, la foto se ve blanda y se descarta.
const ESCALA_MAX_SIN_PERDER = 1.08;

export function escalaParaMinimos(width, height) {
  const largo = Math.max(width, height);
  const corto = Math.min(width, height);
  if (!largo || !corto) return Infinity;
  return Math.max(LADO_LARGO_MIN / largo, LADO_CORTO_MIN / corto);
}

async function varianzaNitidez(buffer) {
  const { channels } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .greyscale()
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .convolve({
      width: 3,
      height: 3,
      kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
    })
    .stats();

  const desviacion = channels?.[0]?.stdev || 0;
  return desviacion * desviacion;
}

export async function evaluarCalidadFoto(buffer) {
  let width = 0;
  let height = 0;

  try {
    const meta = await sharp(buffer, { failOn: 'none' }).rotate().metadata();
    width = meta.width || 0;
    height = meta.height || 0;
  } catch {
    return { ok: false, motivo: 'no se puede leer' };
  }

  if (!width || !height) {
    return { ok: false, motivo: 'no se puede leer' };
  }

  const largo = Math.max(width, height);
  const corto = Math.min(width, height);
  if (largo < LADO_LARGO_MIN || corto < LADO_CORTO_MIN) {
    return { ok: false, motivo: `se ve pequeña (${width}×${height})` };
  }

  try {
    const nitidez = await varianzaNitidez(buffer);
    if (nitidez < NITIDEZ_MIN) {
      return { ok: false, motivo: 'se ve desenfocada' };
    }
  } catch {
    return { ok: false, motivo: 'no se puede leer' };
  }

  return { ok: true, width, height };
}

/**
 * Sube un pelo las fotos que se han quedado justo por debajo del mínimo.
 * Si haría falta estirarlas más de un 8 %, devuelve null y se descartan.
 */
export async function ampliarSiEstaJustoDebajo(buffer) {
  const meta = await sharp(buffer, { failOn: 'none' }).rotate().metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  const escala = escalaParaMinimos(width, height);

  if (escala <= 1) return buffer;
  if (escala > ESCALA_MAX_SIN_PERDER) return null;

  return sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(Math.ceil(width * escala), Math.ceil(height * escala), {
      fit: 'fill',
      kernel: 'lanczos3',
    })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
}
