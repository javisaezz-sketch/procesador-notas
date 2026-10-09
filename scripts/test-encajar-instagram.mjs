import sharp from 'sharp';
import {
  cabeEnFormatoInstagram,
  encajarFotoInstagram,
} from '../lib/encajarFotoInstagram.js';

async function caso(ancho, alto) {
  const raw = await sharp({
    create: {
      width: ancho,
      height: alto,
      channels: 3,
      background: { r: 40, g: 80, b: 120 },
    },
  })
    .jpeg()
    .toBuffer();
  const out = await encajarFotoInstagram(raw);
  const meta = await sharp(out).metadata();
  const ratio = meta.width / meta.height;
  const ok = cabeEnFormatoInstagram(meta.width, meta.height);
  if (!ok) {
    throw new Error(`${ancho}x${alto} salió ${meta.width}x${meta.height} (${ratio})`);
  }
  console.log(`${ancho}x${alto} -> ${meta.width}x${meta.height} ${ratio.toFixed(4)}`);
}

await caso(800, 2000);
await caso(2000, 600);
await caso(1080, 1080);
await caso(1910, 1000);
await caso(800, 1000);
await caso(1080, 1351);
await caso(4000, 800);
