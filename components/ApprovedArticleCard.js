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

function esBorradorWordPress(articulo) {
  return articulo.wp_post_status !== 'publish';
}

export default function ApprovedArticleCard({
  articulo,
  isPublishing,
  onPublishWeb,
}) {
  const theme = getMedioTheme(articulo.medios);
  const borrador = esBorradorWordPress(articulo);

  return (
    <div
      className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 sm:p-6 ${theme.accent}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MedioBadge medio={articulo.medios} />
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            borrador
              ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'
              : 'bg-green-100 text-green-800 ring-1 ring-green-200'
          }`}
        >
          {borrador ? 'Borrador en WP' : 'Publicado en web'}
        </span>
      </div>

      <h2 className="text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">
        {articulo.titulo_generado}
      </h2>

      {articulo.imagen_destacada_url && (
        <img
          src={articulo.imagen_destacada_url}
          alt="Imagen destacada"
          className="mt-4 h-48 w-full rounded-xl object-cover sm:h-40"
        />
      )}

      <div className="mt-4 space-y-2 text-base text-slate-600 sm:text-sm">
        <p>
          <span className="font-medium text-slate-800">Medio:</span>{' '}
          {articulo.medios?.nombre ?? 'Sin medio'}
        </p>
        <p>
          <span className="font-medium text-slate-800">Aprobado:</span>{' '}
          {formatFecha(articulo.fecha_creacion)}
        </p>
        {articulo.wp_post_url && (
          <p className="break-all">
            <span className="font-medium text-slate-800">Enlace:</span>{' '}
            <a
              href={articulo.wp_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-700"
            >
              {borrador ? 'Ver borrador' : 'Ver en la web'}
            </a>
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {borrador ? (
          <button
            type="button"
            onClick={onPublishWeb}
            disabled={isPublishing || !articulo.wp_post_id}
            className="rounded-xl bg-green-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-green-700 disabled:bg-green-400 sm:py-2.5 sm:text-sm"
          >
            {isPublishing ? 'Publicando...' : 'Publicar en la web'}
          </button>
        ) : (
          articulo.wp_post_url && (
            <a
              href={articulo.wp_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex justify-center rounded-xl border border-green-300 bg-green-50 px-4 py-3.5 text-base font-semibold text-green-800 hover:bg-green-100 sm:py-2.5 sm:text-sm"
            >
              Abrir artículo publicado
            </a>
          )
        )}

        {!articulo.wp_post_id && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Sin borrador vinculado en WordPress. Edítalo manualmente en el CMS
            del medio.
          </p>
        )}
      </div>
    </div>
  );
}

export { esBorradorWordPress };
