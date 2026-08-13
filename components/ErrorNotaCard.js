'use client';

import { getMedioTheme } from '@/lib/medios';
import { MedioBadge } from './MedioLogo';

function formatFecha(fecha) {
  if (!fecha) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(fecha));
}

function resumirError(mensaje) {
  if (!mensaje) return 'Error desconocido al procesar con Gemini';

  const texto = String(mensaje);
  if (texto.includes('429') || texto.toLowerCase().includes('quota')) {
    return 'Cuota de Gemini agotada. Reintenta cuando haya cupo disponible.';
  }

  if (texto.length <= 180) return texto;
  return `${texto.slice(0, 177)}...`;
}

function getTituloNota(nota) {
  if (nota.asunto?.trim()) return nota.asunto.trim();

  const linea = nota.contenido_original?.trim().split('\n')[0]?.trim();
  if (linea) {
    return linea.length <= 120 ? linea : `${linea.slice(0, 117)}...`;
  }

  return `Nota #${nota.id}`;
}

export default function ErrorNotaCard({ nota, isRetrying, onRetry, onDismiss }) {
  const theme = getMedioTheme(nota.medios);

  return (
    <div
      className={`flex flex-col rounded-2xl border border-red-200 bg-white p-5 shadow-sm border-l-4 sm:p-6 ${theme.accent}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MedioBadge medio={nota.medios} />
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 ring-1 ring-red-200">
          Error IA
        </span>
      </div>

      <h2 className="text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">
        {getTituloNota(nota)}
      </h2>

      <div className="mt-4 space-y-2 text-base text-slate-600 sm:text-sm">
        <p>
          <span className="font-medium text-slate-800">Medio:</span>{' '}
          {nota.medios?.nombre ?? 'Sin medio'}
        </p>
        <p>
          <span className="font-medium text-slate-800">Recibida:</span>{' '}
          {formatFecha(nota.fecha_recepcion)}
        </p>
        {nota.remitente && (
          <p className="break-all">
            <span className="font-medium text-slate-800">Remitente:</span>{' '}
            {nota.remitente}
          </p>
        )}
      </div>

      <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {resumirError(nota.error_mensaje)}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="rounded-xl bg-indigo-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-400 sm:py-2.5 sm:text-sm"
        >
          {isRetrying ? 'Reintentando...' : 'Reintentar procesamiento'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={isRetrying}
          className="rounded-xl border border-slate-300 px-4 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:py-2.5 sm:text-sm"
        >
          Descartar error
        </button>
      </div>
    </div>
  );
}
