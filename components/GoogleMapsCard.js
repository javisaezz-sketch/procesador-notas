'use client';

import { useState } from 'react';

export default function GoogleMapsCard({
  review,
  onGenerar,
  onDescartar,
  isGenerando = false,
  isDescartando = false,
}) {
  const fotos = Array.isArray(review.fotos) ? review.fotos : [];
  const [fotoSeleccionada, setFotoSeleccionada] = useState(fotos[0] || null);
  const [fotosSeleccionadas, setFotosSeleccionadas] = useState(fotos.slice(0, 10));
  const [expandirTexto, setExpandirTexto] = useState(false);
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false);
  const [instrucciones, setInstrucciones] = useState('');

  function ponerDePortada(url) {
    setFotoSeleccionada(url);
    setFotosSeleccionadas((prev) => {
      const resto = prev.filter((item) => item !== url);
      return [url, ...resto].slice(0, 10);
    });
  }

  const texto = review.texto_original || '';
  const esTextoLargo = texto.length > 220;
  const textoVisible =
    esTextoLargo && !expandirTexto ? `${texto.slice(0, 220).trim()}...` : texto;

  const estrellas = Number(review.stars) || 5;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {/* 1. Cabecera con imagen destacada seleccionable */}
      {fotos.length > 0 && (
        <div className="relative bg-slate-900">
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-stone-100 sm:aspect-[16/9]">
            <img
              src={fotoSeleccionada || fotos[0]}
              alt={review.place_name}
              className="h-full w-full object-contain transition-all duration-300"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

            {/* Badge de Google Maps & Fecha */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow backdrop-blur-sm">
                <svg className="h-3.5 w-3.5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
                </svg>
                Google Maps
              </span>
              {review.city && (
                <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {review.city}
                </span>
              )}
            </div>

            {/* Número de fotos */}
            <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {fotos.length} foto{fotos.length === 1 ? '' : 's'}
            </div>

            {/* Nombre del local sobre el degradado inferior */}
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <h3 className="text-lg font-bold leading-tight drop-shadow-sm sm:text-xl">
                {review.place_name}
              </h3>
            </div>
          </div>

          {/* Selector de miniaturas: clic para previsualizar, check para incluir en el carrusel */}
          {fotos.length > 1 && (
            <div className="space-y-2 p-2.5 bg-slate-900/90">
              <p className="px-0.5 text-[11px] font-medium text-slate-300">
                Pulsa una foto para ponerla la primera. La 1 es la portada. Se publica entera, sin recortar.
              </p>
              <div className="flex gap-2 overflow-x-auto scrollbar-thin">
                {fotos.map((url, idx) => {
                  const estaIncluida = fotosSeleccionadas.includes(url);
                  const orden = fotosSeleccionadas.indexOf(url);
                  return (
                    <div key={idx} className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => ponerDePortada(url)}
                        className={`relative overflow-hidden rounded-lg transition-all ${
                          orden === 0
                            ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-slate-900'
                            : estaIncluida
                              ? 'opacity-100'
                              : 'opacity-50 hover:opacity-80'
                        }`}
                        title={orden === 0 ? 'Portada del carrusel' : `Poner la foto ${idx + 1} la primera`}
                      >
                        <img
                          src={url}
                          alt={`Miniatura ${idx + 1}`}
                          className="h-12 w-16 object-contain bg-stone-100"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                        {estaIncluida && (
                          <span className={`absolute bottom-0.5 left-0.5 rounded px-1 text-[10px] font-bold leading-4 ${
                            orden === 0 ? 'bg-pink-500 text-white' : 'bg-black/70 text-white'
                          }`}>
                            {orden + 1}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFotosSeleccionadas((prev) => {
                            if (prev.includes(url)) {
                              if (prev.length === 1) return prev;
                              const next = prev.filter((item) => item !== url);
                              if (fotoSeleccionada === url) {
                                setFotoSeleccionada(next[0] || fotos[0] || null);
                              }
                              return next;
                            }
                            return [...prev, url].slice(0, 10);
                          });
                        }}
                        className={`absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shadow ${
                          estaIncluida
                            ? 'bg-pink-500 text-white'
                            : 'bg-white/90 text-slate-500'
                        }`}
                        title={estaIncluida ? 'Quitar del carrusel' : 'Añadir al carrusel'}
                      >
                        {estaIncluida ? '✓' : '+'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Cuerpo de la tarjeta */}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {/* En caso de que no haya fotos */}
        {fotos.length === 0 && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
              </svg>
              Google Maps
            </span>
            <h3 className="mt-2 text-xl font-bold text-slate-900">{review.place_name}</h3>
          </div>
        )}

        {/* Estrellas y Fecha */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="text-lg leading-none">
                {i < estrellas ? '★' : '☆'}
              </span>
            ))}
            <span className="ml-1 font-semibold text-slate-700">({estrellas}/5)</span>
          </div>
          {review.relative_date && (
            <span className="text-xs text-slate-500">{review.relative_date}</span>
          )}
        </div>

        {/* Dirección y enlace a Maps */}
        <div className="mt-2 text-xs text-slate-500">
          <p className="truncate">{review.address || review.city || 'Ubicación no detallada'}</p>
          {review.maps_url && (
            <a
              href={review.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800"
            >
              <span>Ver ficha en Google Maps</span>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>

        {/* Texto de la reseña */}
        <div className="mt-4 flex-1">
          {texto ? (
            <div className="rounded-xl bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-700">
              <p className="whitespace-pre-line italic text-slate-600">
                &ldquo;{textoVisible}&rdquo;
              </p>
              {esTextoLargo && (
                <button
                  type="button"
                  onClick={() => setExpandirTexto(!expandirTexto)}
                  className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {expandirTexto ? 'Mostrar menos' : 'Leer reseña completa'}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs italic text-slate-400">
              Reseña con valoración y fotos (sin comentario de texto).
            </div>
          )}
        </div>

        {/* Opcional: Instrucciones adicionales para la IA */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setMostrarInstrucciones(!mostrarInstrucciones)}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <span>{mostrarInstrucciones ? '▲ Ocultar indicaciones' : '▼ Añadir enfoque o notas para la IA'}</span>
          </button>
          {mostrarInstrucciones && (
            <div className="mt-2">
              <input
                type="text"
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                placeholder="Ej: Destaca la burger trufada y el postre casero..."
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
              />
            </div>
          )}
        </div>

        {/* 3. Botones de acción */}
        <div className="mt-5 flex items-center gap-2 pt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={isGenerando || isDescartando}
            onClick={() => {
              const seleccionadas = (
                fotosSeleccionadas.length > 0 ? fotosSeleccionadas : fotos
              ).slice(0, 10);
              const portada = fotoSeleccionada || seleccionadas[0] || null;
              const ordenadas = portada
                ? [portada, ...seleccionadas.filter((url) => url !== portada)]
                : seleccionadas;
              onGenerar({
                review,
                fotoSeleccionadaUrl: portada,
                fotosSeleccionadas: ordenadas,
                instruccionesEditor: instrucciones.trim(),
              });
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-pink-700 hover:to-rose-700 disabled:opacity-50"
          >
            {isGenerando ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>Publicando en Instagram...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
                <span>
                  {fotosSeleccionadas.length > 1
                    ? `Generar y publicar (${fotosSeleccionadas.length} fotos)`
                    : 'Generar y publicar en Instagram'}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isGenerando || isDescartando}
            onClick={() => onDescartar(review)}
            className="rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-red-600 transition disabled:opacity-50"
            title="Descartar reseña"
          >
            {isDescartando ? 'Descartando...' : 'Descartar'}
          </button>
        </div>
      </div>
    </div>
  );
}
