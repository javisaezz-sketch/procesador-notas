'use client';

import { useEffect, useState } from 'react';
import { MedioBadge } from './MedioLogo';
import ImageGalleryPicker from './ImageGalleryPicker';

export default function ContentModal({
  articulo,
  title,
  content,
  emailNotificacion,
  imagenes = [],
  destacadaUrl,
  publicarUrls = [],
  imagenesCargando = false,
  onTitleChange,
  onContentChange,
  onEmailNotificacionChange,
  onDestacadaChange,
  onPublicarChange,
  onClose,
  onSave,
  isSaving,
  saveError,
}) {
  const [vista, setVista] = useState('editar');

  useEffect(() => {
    setVista('editar');
  }, [articulo.id]);

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
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-indigo-600 sm:text-sm">
                Revisión del artículo
              </p>
              <div className="mt-2">
                <MedioBadge medio={articulo.medios} />
              </div>
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
          <div className="mb-6">
            {imagenesCargando ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Cargando imágenes...
              </div>
            ) : (
              <ImageGalleryPicker
                imagenes={imagenes}
                destacadaUrl={destacadaUrl}
                publicarUrls={publicarUrls}
                onDestacadaChange={onDestacadaChange}
                onPublicarChange={onPublicarChange}
              />
            )}
          </div>

          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <label
              htmlFor="email-notificacion"
              className="mb-1 block text-base font-semibold text-emerald-900 sm:text-sm"
            >
              Email de notificación a la agencia
            </label>
            <p className="mb-3 text-sm text-emerald-800">
              Se enviará cuando publiques el borrador en WordPress. Revísalo y
              corrígelo si hace falta.
            </p>
            <input
              id="email-notificacion"
              type="email"
              value={emailNotificacion}
              onChange={(event) => onEmailNotificacionChange(event.target.value)}
              placeholder="Sin email detectado en la nota"
              className="w-full rounded-xl border border-emerald-300 bg-white px-4 py-3.5 text-base text-slate-900 outline-none ring-emerald-500 focus:ring-2 sm:py-3 sm:text-sm"
            />
          </div>

          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setVista('editar')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                vista === 'editar'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Editar HTML
            </button>
            <button
              type="button"
              onClick={() => setVista('vista')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                vista === 'vista'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Vista previa
            </button>
          </div>

          {vista === 'editar' ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="titulo-generado"
                  className="mb-2 block text-base font-medium text-slate-700 sm:text-sm"
                >
                  Título del artículo
                </label>
                <input
                  id="titulo-generado"
                  type="text"
                  value={title}
                  onChange={(event) => onTitleChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base font-semibold text-slate-900 outline-none ring-indigo-500 focus:ring-2 sm:py-3 sm:text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="contenido-generado"
                  className="mb-2 block text-base font-medium text-slate-700 sm:text-sm"
                >
                  Contenido HTML
                </label>
                <textarea
                  id="contenido-generado"
                  value={content}
                  onChange={(event) => onContentChange(event.target.value)}
                  className="min-h-[280px] w-full rounded-xl border border-slate-300 px-4 py-4 font-mono text-base leading-7 text-slate-800 outline-none ring-indigo-500 focus:ring-2 sm:min-h-[320px] sm:px-4 sm:py-3 sm:text-sm sm:leading-6"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <h2 className="mb-4 text-2xl font-bold leading-snug text-slate-900 sm:text-xl">
                {title || 'Sin título'}
              </h2>
              <div
                className="max-w-none text-base leading-relaxed text-slate-800 sm:text-sm [&_a]:text-indigo-600 [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg [&_p]:mb-4"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          )}

          <p className="mt-3 text-base text-slate-500 sm:text-sm">
            Guarda los cambios antes de publicar. Título, contenido, imágenes y
            email se usarán al crear el borrador en WordPress.
          </p>

          {saveError && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700 sm:text-sm">
              {saveError}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-5 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-300 px-4 py-3.5 text-base font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:py-2.5 sm:text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-xl bg-indigo-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:bg-indigo-400 sm:py-2.5 sm:text-sm"
          >
            {isSaving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
