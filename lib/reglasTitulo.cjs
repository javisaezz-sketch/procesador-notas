const REGLAS_TITULO_BLOQUE = `
REGLAS OBLIGATORIAS PARA titulo_generado (TODOS LOS MEDIOS):
- PROHIBIDO usar dos puntos (:). Separa ideas con guiones, comas o puntos finales.
- PROHIBIDO usar la palabra "arquitectura" en el titular (en cualquier forma o mayúsculas).
`.trim();

const REGLAS_TITULO_INLINE = `
- PROHIBIDO en titulo_generado: dos puntos (:) y la palabra "arquitectura".
`.trim();

function sanitizarTituloGenerado(titulo) {
  let result = String(titulo ?? '').trim();

  result = result.replace(/:/g, ' —');
  result = result.replace(/\barquitectura\b/gi, '');
  result = result.replace(/\s+/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
  result = result.replace(/^[\s—–-]+|[\s—–-]+$/g, '').trim();

  return result;
}

function promptIncluyeReglasTitulo(prompt) {
  const texto = String(prompt ?? '');
  return (
    texto.includes('PROHIBIDO usar dos puntos') ||
    texto.includes('PROHIBIDO en titulo_generado: dos puntos')
  );
}

function anadirReglasTituloAlPrompt(prompt) {
  const texto = String(prompt ?? '').trim();

  if (!texto || promptIncluyeReglasTitulo(texto)) {
    return texto;
  }

  if (/4\.\s*CONTROL DE SALIDA/i.test(texto)) {
    return texto.replace(
      /(4\.\s*CONTROL DE SALIDA[^\n]*\n)/i,
      `$1${REGLAS_TITULO_BLOQUE}\n`,
    );
  }

  return `${texto}\n\n${REGLAS_TITULO_BLOQUE}`;
}

function normalizarTerminoEstructuraEnPrompt(prompt) {
  return String(prompt ?? '').replace(
    /Arquitectura Interna/g,
    'Estructura interna del artículo',
  );
}

module.exports = {
  REGLAS_TITULO_BLOQUE,
  REGLAS_TITULO_INLINE,
  sanitizarTituloGenerado,
  promptIncluyeReglasTitulo,
  anadirReglasTituloAlPrompt,
  normalizarTerminoEstructuraEnPrompt,
};
