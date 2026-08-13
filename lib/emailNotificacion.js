import { resolverEmailNotificacionDesdeNota } from './extraerRemitenteEmail';

export function resolverEmailNotificacionArticulo(articulo, nota) {
  const guardado = articulo?.email_notificacion?.trim();
  if (guardado) {
    return guardado;
  }

  return resolverEmailNotificacionDesdeNota(nota);
}
