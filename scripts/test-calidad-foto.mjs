import assert from 'assert';
import sharp from 'sharp';
import { ampliarSiEstaJustoDebajo, evaluarCalidadFoto } from '../lib/calidadFoto.js';

async function ruido(ancho, alto) {
  const raw = Buffer.alloc(ancho * alto * 3);
  for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 17) % 256;
  return sharp(raw, { raw: { width: ancho, height: alto, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

const buena = await evaluarCalidadFoto(await ruido(1200, 1600));
assert.strictEqual(buena.ok, true, JSON.stringify(buena));

const pequena = await evaluarCalidadFoto(await ruido(480, 640));
assert.strictEqual(pequena.ok, false);
assert.match(pequena.motivo, /pequeña/);
assert.strictEqual(await ampliarSiEstaJustoDebajo(await ruido(480, 640)), null);

const justa = await ruido(599, 899);
assert.strictEqual((await evaluarCalidadFoto(justa)).ok, false);
const ampliada = await ampliarSiEstaJustoDebajo(justa);
assert.ok(ampliada);
const trasAmpliar = await evaluarCalidadFoto(ampliada);
assert.strictEqual(trasAmpliar.ok, true, JSON.stringify(trasAmpliar));

const borrosa = await evaluarCalidadFoto(await sharp(await ruido(1200, 1600)).blur(12).jpeg().toBuffer());
assert.strictEqual(borrosa.ok, false);
assert.match(borrosa.motivo, /desenfocada/);

console.log('OK');
