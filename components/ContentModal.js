'use client';

import { MedioBadge } from './MedioLogo';

export default function ContentModal({
  articulo,
  content,
  onContentChange,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:max-w-4xl sm:rounded-2xl">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4 sm:gap-4">
            <div className="min-w-0">
              <p className="text-base font-medium text-indigo-600 sm:text-sm">
                Edición de contenido
              </p>
              <div className="mt-2">
                <MedioBadge medio={articulo.medios} />
              </div>
              <h3 className="mt-3 text-2xl font-bold leading-snug text-slate-900 sm:text-2xl">
                {articulo.titulo_generado}
              </h3>
              <p className="mt-2 text-base text-slate-600 sm:text-sm">
                Medio: {articulo.medios?.nombre ?? 'Sin medio'} · Artículo #
                {articulo.id}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg px-4 py-2 text-base font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:px-3 sm:py-1.5 sm:text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-5">
          <label
            htmlFor="contenido-generado"
            className="mb-2 block text-base font-medium text-slate-700 sm:text-sm"
          >
            Contenido generado (HTML)
          </label>
          <textarea
            id="contenido-generado"
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            className="min-h-[280px] w-full rounded-xl border border-slate-300 px-4 py-4 font-mono text-base leading-7 text-slate-800 outline-none ring-indigo-500 focus:ring-2 sm:min-h-[320px] sm:px-4 sm:py-3 sm:text-sm sm:leading-6"
          />
          <p className="mt-3 text-base text-slate-500 sm:text-sm">
            Por ahora puedes revisar y editar el texto localmente. La
            publicación se conectará en el siguiente paso.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-5 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-3.5 text-base font-semibold text-slate-700 transition hover:bg-slate-50 sm:py-2.5 sm:text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-indigo-700 sm:py-2.5 sm:text-sm"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
