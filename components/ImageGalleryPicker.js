'use client';

export default function ImageGalleryPicker({
  imagenes = [],
  destacadaUrl,
  publicarUrls = [],
  onDestacadaChange,
  onPublicarChange,
}) {
  if (!imagenes.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Este artículo no tiene imágenes en la nota de prensa.
      </div>
    );
  }

  const publicarSet = new Set(publicarUrls);

  function togglePublicar(url) {
    const next = new Set(publicarSet);

    if (next.has(url)) {
      next.delete(url);
    } else {
      next.add(url);
    }

    const nextUrls = imagenes
      .map((imagen) => imagen.url)
      .filter((item) => next.has(item));

    onPublicarChange(nextUrls);

    if (!next.has(destacadaUrl)) {
      onDestacadaChange(nextUrls[0] ?? null);
    }
  }

  function marcarDestacada(url) {
    if (!publicarSet.has(url)) {
      const nextUrls = imagenes
        .map((imagen) => imagen.url)
        .filter((item) => publicarSet.has(item) || item === url);
      onPublicarChange(nextUrls);
    }

    onDestacadaChange(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-medium text-slate-700 sm:text-sm">
          Imágenes de la nota
        </p>
        <p className="text-sm text-slate-500">
          {publicarUrls.length} de {imagenes.length} seleccionada
          {publicarUrls.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {imagenes.map((imagen) => {
          const incluida = publicarSet.has(imagen.url);
          const esDestacada = destacadaUrl === imagen.url;

          return (
            <div
              key={imagen.id ?? imagen.url}
              className={`relative overflow-hidden rounded-xl border-2 bg-slate-100 transition ${
                incluida
                  ? esDestacada
                    ? 'border-amber-400 ring-2 ring-amber-200'
                    : 'border-indigo-400 ring-2 ring-indigo-100'
                  : 'border-slate-200 opacity-70'
              }`}
            >
              <img
                src={imagen.url}
                alt={imagen.nombre_archivo || 'Imagen de la nota'}
                className="aspect-square w-full object-cover"
              />

              {esDestacada && incluida && (
                <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-amber-950 sm:text-xs">
                  Destacada
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent p-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={incluida}
                    onChange={() => togglePublicar(imagen.url)}
                    className="h-4 w-4 rounded border-white/30 text-indigo-600"
                  />
                  Publicar
                </label>

                <button
                  type="button"
                  onClick={() => marcarDestacada(imagen.url)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    esDestacada && incluida
                      ? 'bg-amber-400 text-amber-950'
                      : 'bg-white/90 text-slate-700 hover:bg-white'
                  }`}
                  title="Marcar como imagen destacada"
                >
                  ★
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-slate-500">
        Marca qué fotos quieres publicar y elige la destacada con la estrella. La
        destacada va en WordPress; el resto se añade al final del artículo.
      </p>
    </div>
  );
}
