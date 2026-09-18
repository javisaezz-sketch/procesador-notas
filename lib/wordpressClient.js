export function normalizarUrlWordPress(url) {
  return url.trim().replace(/\/+$/, '');
}

export function normalizarMedio(medio) {
  return {
    ...medio,
    url_wordpress: normalizarUrlWordPress(medio.url_wordpress),
    api_user: medio.api_user.trim(),
    api_password: medio.api_password.replace(/\s+/g, ''),
  };
}

export function crearAuthHeader(medio) {
  const credentials = Buffer.from(
    `${medio.api_user}:${medio.api_password}`,
  ).toString('base64');

  return `Basic ${credentials}`;
}

/** Cabeceras comunes (User-Agent fijo para whitelist en Imunify360 / WAF). */
export function headersWordPress(medio, extra = {}) {
  const userAgent =
    process.env.WORDPRESS_USER_AGENT?.trim() ||
    'PanelEditorial-SaezNaves/1.0 (+https://panel-editorial.vercel.app)';

  return {
    Authorization: crearAuthHeader(medio),
    Accept: 'application/json',
    'User-Agent': userAgent,
    ...extra,
  };
}

export function mensajeAyudaImunify360() {
  return (
    ' Imunify360 está bloqueando el panel (Vercel). En el hosting: excepción para /wp-json/ ' +
    'o whitelist del User-Agent "PanelEditorial-SaezNaves". Desde tu PC la API sí funciona.'
  );
}

export async function parsearRespuestaWordPress(response) {
  const responseBody = await response.text();
  let parsedBody = null;

  if (responseBody) {
    try {
      parsedBody = JSON.parse(responseBody);
    } catch {
      parsedBody = { message: responseBody };
    }
  }

  return parsedBody;
}

export function etiquetaMedioWordPress(medio) {
  return medio?.nombre || medio?.slug || 'WordPress';
}

export async function actualizarPostWordPress(medioRaw, postId, payload) {
  const medio = normalizarMedio(medioRaw);
  const endpoint = `${medio.url_wordpress}/wp-json/wp/v2/posts/${Number(postId)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: headersWordPress(medio, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const parsedBody = await parsearRespuestaWordPress(response);

  if (!response.ok) {
    const wpMessage =
      parsedBody?.message ||
      parsedBody?.code ||
      `Error HTTP ${response.status}`;

    throw new Error(
      `${etiquetaMedioWordPress(medio)} rechazó la actualización del post: ${wpMessage}`,
    );
  }

  return parsedBody;
}

export async function leerPostWordPress(medioRaw, postId, { context = 'edit' } = {}) {
  const medio = normalizarMedio(medioRaw);
  const endpoint = `${medio.url_wordpress}/wp-json/wp/v2/posts/${Number(postId)}?context=${context}`;

  const response = await fetch(endpoint, {
    headers: headersWordPress(medio),
    cache: 'no-store',
  });

  const parsedBody = await parsearRespuestaWordPress(response);

  if (!response.ok) {
    const wpMessage =
      parsedBody?.message ||
      parsedBody?.code ||
      `Error HTTP ${response.status}`;

    throw new Error(
      `${etiquetaMedioWordPress(medio)} no devolvió el post ${postId}: ${wpMessage}`,
    );
  }

  return parsedBody;
}
