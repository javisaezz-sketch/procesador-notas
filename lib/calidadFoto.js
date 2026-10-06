import sharp from 'sharp';

const LADO_LARGO_MIN = 900;
const LADO_CORTO_MIN = 600;
const NITIDEZ_MIN = 40;

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
