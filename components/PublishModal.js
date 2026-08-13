'use client';

import { getCategoriasMedio } from '@/lib/medios';
import { MedioBadge } from './MedioLogo';

export default function PublishModal({ articulo, onClose, onConfirm, isPublishing }) {
  const categorias = getCategoriasMedio(articulo.medios);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6">
        <p className="text-sm font-medium text-indigo-600">Publicar en WordPress</p>
        <div className="mt-2">
          <MedioBadge medio={articulo.medios} />
        </div>
        <h3 className="mt-3 text-lg font-bold leading-snug text-slate-900 sm:text-xl">
          {articulo.titulo_generado}
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Se creará como <strong>borrador</strong> en WordPress. Elige la categoría:
        </p>

        {articulo.imagen_destacada_url && (
          <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            La primera foto de la nota se usará como imagen destacada.
            {(articulo.imagenes_adicionales ?? 0) > 0 ? (
              <>
                {' '}
                Las otras <strong>{articulo.imagenes_adicionales}</strong> se
                añadirán al final del artículo al publicar.
              </>
            ) : (
              <> No se duplica en el cuerpo del texto.</>
            )}
          </p>
        )}

        {!articulo.imagen_destacada_url && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Este artículo no tiene imagen destacada. El borrador se publicará sin foto
            a menos que el email traiga imágenes adjuntas o incrustadas en el HTML.
          </p>
        )}

        {articulo.email_notificacion && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            El email de la agencia (<strong>{articulo.email_notificacion}</strong>) quedará
            guardado en el borrador. La notificación se enviará cuando pulses{' '}
            <strong>Publicar</strong> en WordPress.
          </p>
        )}

        <form
          className="mt-5 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const categoriaSlug = formData.get('categoria');
            if (categoriaSlug) onConfirm(String(categoriaSlug));
          }}
        >
          <fieldset className="space-y-2">
            {categorias.map((cat) => (
              <label
                key={cat.slug}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                <input
                  type="radio"
                  name="categoria"
                  value={cat.slug}
                  required
                  className="h-4 w-4 text-indigo-600"
                />
                <span className="text-sm font-medium text-slate-800">{cat.nombre}</span>
                <span className="ml-auto text-xs text-slate-400">{cat.slug}</span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isPublishing}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPublishing}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-400"
            >
              {isPublishing ? 'Publicando...' : 'Publicar borrador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
