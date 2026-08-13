'use client';

export default function Error({ error, reset }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
          <p className="text-lg font-semibold">Error al cargar el dashboard</p>
          <p className="mt-2 text-sm">{error.message}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    </main>
  );
}
