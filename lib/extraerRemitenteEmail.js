const DOMINIOS_INTERNOS = [
  '@vidaystyle.com',
  '@travelicius.es',
  '@travelicius.com',
  '@glamcloset.cat',
  '@femnegoci.es',
];

function esEmailValido(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function limpiarEmail(email) {
  return email.trim().toLowerCase();
}

function esEmailInterno(email) {
  const lower = limpiarEmail(email);
  return DOMINIOS_INTERNOS.some((dominio) => lower.endsWith(dominio));
}

function extraerEmailDeLinea(linea) {
  if (!linea) return null;

  const mailto = linea.match(/mailto:([^"'>\s]+)/i);
  if (mailto?.[1] && esEmailValido(mailto[1])) {
    return limpiarEmail(mailto[1]);
  }

  const conNombre = linea.match(/<([^>]+@[^>]+)>/);
  if (conNombre?.[1] && esEmailValido(conNombre[1])) {
    return limpiarEmail(conNombre[1]);
  }

  const directo = linea.match(/(?:From|De|Para|To):\s*[^<\n]*?([^\s<>"']+@[^\s<>"']+)/i);
  if (directo?.[1] && esEmailValido(directo[1])) {
    return limpiarEmail(directo[1]);
  }

  return null;
}

function htmlATexto(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<a[^>]+href=["']mailto:([^"']+)["'][^>]*>[^<]*<\/a>/gi, '<$1>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function encontrarInicioReenvio(contenido) {
  const marcadores = [
    /-{5,}\s*Forwarded message\s*-{5,}/i,
    /-{5,}\s*Mensaje reenviado\s*-{5,}/i,
    /Begin forwarded message/i,
    /-----Original Message-----/i,
  ];

  for (const regex of marcadores) {
    const match = contenido.match(regex);
    if (match?.index != null) {
      return match.index + match[0].length;
    }
  }

  return -1;
}

function extraerDesdeBloqueReenviado(bloque) {
  if (!bloque) return null;

  const lineas = bloque.split(/\r?\n/);

  for (const linea of lineas.slice(0, 12)) {
    if (/^(From|De):/i.test(linea.trim())) {
      const email = extraerEmailDeLinea(linea);
      if (email && !esEmailInterno(email)) {
        return email;
      }
    }
  }

  const mailto = bloque.match(/mailto:([^"'>\s]+)/i);
  if (mailto?.[1] && esEmailValido(mailto[1]) && !esEmailInterno(mailto[1])) {
    return limpiarEmail(mailto[1]);
  }

  const patrones = [
    /(?:From|De):\s*[\s\S]{0,300}?<([^>]+@[^>]+)>/i,
    /(?:From|De):\s*[\s\S]{0,300}?([^\s<>"']+@[^\s<>"']+)/i,
  ];

  for (const regex of patrones) {
    const match = bloque.match(regex);
    if (match?.[1] && esEmailValido(match[1]) && !esEmailInterno(match[1])) {
      return limpiarEmail(match[1]);
    }
  }

  return null;
}

export function extraerRemitenteForwarded(contenido) {
  if (!contenido) return null;

  const variantes = [contenido];
  if (/<[a-z][\s\S]*>/i.test(contenido)) {
    variantes.push(htmlATexto(contenido));
  }

  for (const texto of variantes) {
    const inicio = encontrarInicioReenvio(texto);
    if (inicio >= 0) {
      const email = extraerDesdeBloqueReenviado(texto.slice(inicio, inicio + 2500));
      if (email) return email;
    }
  }

  return null;
}

export function resolverEmailNotificacion(parsed) {
  const reenviadoTexto = extraerRemitenteForwarded(parsed.text || '');
  if (reenviadoTexto) return reenviadoTexto;

  const reenviadoHtml = extraerRemitenteForwarded(parsed.html || '');
  if (reenviadoHtml) return reenviadoHtml;

  const replyTo = parsed.replyTo?.value?.[0]?.address;
  if (esEmailValido(replyTo) && !esEmailInterno(replyTo)) {
    return limpiarEmail(replyTo);
  }

  const from = parsed.from?.value?.[0]?.address;
  if (esEmailValido(from) && !esEmailInterno(from)) {
    return limpiarEmail(from);
  }

  return null;
}

export function resolverEmailNotificacionDesdeNota(nota) {
  if (!nota) return null;

  const reenviadoTexto = extraerRemitenteForwarded(nota.contenido_original || '');
  if (reenviadoTexto) return reenviadoTexto;

  const reenviadoHtml = extraerRemitenteForwarded(nota.contenido_html || '');
  if (reenviadoHtml) return reenviadoHtml;

  const remitente = nota.remitente?.trim();
  if (remitente && esEmailValido(remitente) && !esEmailInterno(remitente)) {
    return limpiarEmail(remitente);
  }

  return null;
}
