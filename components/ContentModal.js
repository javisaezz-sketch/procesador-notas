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
        <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-indigo-600">
                Edición de contenido
              </p>
              <div className="mt-2">
                <MedioBadge medio={articulo.medios} />
              </div>
              <h3 className="mt-3 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
                {articulo.titulo_generado}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Medio: {articulo.medios?.nombre ?? 'Sin medio'} · Artículo #
                {articulo.id}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <label
            htmlFor="contenido-generado"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Contenido generado (HTML)
          </label>
          <textarea
            id="contenido-generado"
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            className="min-h-[240px] w-full rounded-xl border border-slate-300 px-3 py-3 font-mono text-sm leading-6 text-slate-800 outline-none ring-indigo-500 focus:ring-2 sm:min-h-[320px] sm:px-4"
          />
          <p className="mt-3 text-sm text-slate-500">
            Por ahora puedes revisar y editar el texto localmente. La
            publicación se conectará en el siguiente paso.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
