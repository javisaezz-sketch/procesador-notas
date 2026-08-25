'use client';

import { useEffect, useState } from 'react';
import { compararMedios, getMedioTheme } from '@/lib/medios';
import { MedioBadge } from './MedioLogo';

export default function ReenviarMedioModal({
  articulo,
  medios = [],
  onClose,
  onConfirm,
  isSubmitting,
}) {
  const destinos = medios
    .filter((medio) => medio.id !== articulo.medio_id)
    .sort(compararMedios);
  const [medioId, setMedioId] = useState(destinos[0]?.id ?? null);

  useEffect(() => {
    setMedioId(destinos[0]?.id ?? null);
  }, [articulo.id, destinos.length]);

  const medioSeleccionado = destinos.find((medio) => medio.id === medioId);

  function enviar() {
    if (!medioId) return;
    onConfirm(medioId);
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
        <p className="text-base font-medium text-violet-600 sm:text-sm">
          Procesar en otro medio
        </p>
        <div className="mt-2">
          <MedioBadge medio={articulo.medios} />
        </div>
        <h3 className="mt-3 text-xl font-bold leading-snug text-slate-900">
          {articulo.titulo_generado}
        </h3>
        <p className="mt-2 text-base text-slate-600 sm:text-sm">
          La nota de prensa original volverá a la cola de Gemini con el tono y
          estilo del medio que elijas. Se creará un artículo nuevo; este no se
          modifica.
        </p>

        {destinos.length === 0 ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No hay otros medios configurados.
          </p>
        ) : (
          <fieldset className="mt-5 space-y-2">
            {destinos.map((medio) => {
              const theme = getMedioTheme(medio);

              return (
                <label
                  key={medio.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-4 transition hover:bg-slate-50 sm:py-3 ${
                    medioId === medio.id
                      ? 'border-violet-400 bg-violet-50'
                      : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="medioDestino"
                    value={medio.id}
                    checked={medioId === medio.id}
                    onChange={() => setMedioId(medio.id)}
                    className="h-5 w-5 shrink-0 text-violet-600"
                  />
                  <span
                    className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${theme.dot}`}
                  />
                  <span className="text-base font-medium text-slate-800 sm:text-sm">
                    {medio.nombre}
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        {medioSeleccionado && (
          <p className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            El pipeline procesará la nota para{' '}
            <strong>{medioSeleccionado.nombre}</strong> en los próximos minutos.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={enviar}
            disabled={isSubmitting || !medioId}
            className="rounded-xl bg-violet-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-violet-700 disabled:bg-violet-400 sm:py-2.5 sm:text-sm"
          >
            {isSubmitting ? 'Encolando...' : 'Enviar a la cola del medio'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-300 px-4 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50 sm:py-2.5 sm:text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
