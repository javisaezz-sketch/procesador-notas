'use client';

import { useRef } from 'react';
import { getCategoriasMedio } from '@/lib/medios';
import { MedioBadge } from './MedioLogo';

export default function PublishModal({ articulo, onClose, onConfirm, isPublishing }) {
  const formRef = useRef(null);
  const categorias = getCategoriasMedio(articulo.medios);
  const totalPublicar = Array.isArray(articulo.imagenes_publicar_urls)
    ? articulo.imagenes_publicar_urls.length
    : articulo.imagen_destacada_url
      ? (articulo.imagenes_adicionales ?? 0) + 1
      : 0;
  const galeriaCount = articulo.imagen_destacada_url
    ? Math.max(totalPublicar - 1, articulo.imagenes_adicionales ?? 0)
    : Math.max(totalPublicar, 0);

  function enviar(publicarEnWeb) {
    if (!formRef.current) return;

    const formData = new FormData(formRef.current);
    const categoriaSlug = formData.get('categoria');

    if (!categoriaSlug) {
      formRef.current.reportValidity();
      return;
    }

    onConfirm(String(categoriaSlug), { publicarEnWeb });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6">
        <p className="text-base font-medium text-indigo-600 sm:text-sm">
          Enviar a WordPress
        </p>
        <div className="mt-2">
          <MedioBadge medio={articulo.medios} />
        </div>
        <h3 className="mt-3 text-xl font-bold leading-snug text-slate-900 sm:text-xl">
          {articulo.titulo_generado}
        </h3>
        <p className="mt-2 text-base text-slate-600 sm:text-sm">
          Elige categoría y cómo quieres publicarlo:
        </p>

        {articulo.imagen_destacada_url && (
          <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-base text-blue-800 sm:text-sm">
            Se publicará con imagen destacada
            {galeriaCount > 0 ? (
              <>
                {' '}
                y <strong>{galeriaCount}</strong> foto
                {galeriaCount === 1 ? '' : 's'} más al final del artículo.
              </>
            ) : (
              <>.</>
            )}
          </p>
        )}

        {!articulo.imagen_destacada_url && totalPublicar > 0 && (
          <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-base text-blue-800 sm:text-sm">
            Se publicarán <strong>{totalPublicar}</strong> imagen
            {totalPublicar === 1 ? '' : 'es'} al final del artículo, sin foto destacada.
          </p>
        )}

        {!articulo.imagen_destacada_url && totalPublicar === 0 && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-base text-amber-800 sm:text-sm">
            Este artículo no tiene imagen destacada. Se publicará sin foto
            a menos que el email traiga imágenes adjuntas o incrustadas en el HTML.
          </p>
        )}

        {articulo.email_notificacion && !articulo.sin_notificacion && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-base text-emerald-800 sm:text-sm">
            El email de la agencia (<strong>{articulo.email_notificacion}</strong>) quedará
            guardado en WordPress. La notificación se enviará al publicar en la web.
          </p>
        )}

        {articulo.sin_notificacion && (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-700 sm:text-sm">
            Artículo desde enlace: no se notificará a ninguna agencia.
          </p>
        )}

        <form ref={formRef} className="mt-5 space-y-5" onSubmit={(event) => event.preventDefault()}>
          <fieldset className="space-y-2">
            {categorias.map((cat) => (
              <label
                key={cat.slug}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-4 transition hover:border-indigo-300 hover:bg-indigo-50 sm:py-3"
              >
                <input
                  type="radio"
                  name="categoria"
                  value={cat.slug}
                  required
                  className="h-5 w-5 shrink-0 text-indigo-600 sm:h-4 sm:w-4"
                />
                <span className="text-base font-medium text-slate-800 sm:text-sm">{cat.nombre}</span>
                <span className="ml-auto hidden text-xs text-slate-400 sm:inline">{cat.slug}</span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => enviar(true)}
              disabled={isPublishing}
              className="rounded-xl bg-green-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-green-700 disabled:bg-green-400 sm:py-2.5 sm:text-sm"
            >
              {isPublishing ? 'Publicando...' : 'Publicar en la web'}
            </button>
            <button
              type="button"
              onClick={() => enviar(false)}
              disabled={isPublishing}
              className="rounded-xl bg-indigo-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-400 sm:py-2.5 sm:text-sm"
            >
              {isPublishing ? 'Guardando...' : 'Solo borrador (publicar después)'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isPublishing}
              className="rounded-xl border border-slate-300 px-4 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50 sm:py-2.5 sm:text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
