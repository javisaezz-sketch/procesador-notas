import { resolverEmailNotificacionDesdeNota } from './extraerRemitenteEmail';
import { esNotaDesdeUrl } from './extraerContenidoUrl';

export function resolverEmailNotificacionArticulo(articulo, nota) {
  if (esNotaDesdeUrl(nota)) {
    return null;
  }

  const guardado = articulo?.email_notificacion?.trim();
  if (guardado) {
    return guardado;
  }

  return resolverEmailNotificacionDesdeNota(nota);
}
