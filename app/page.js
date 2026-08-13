import ArticleDashboard from '../components/ArticleDashboard';
import LogoutButton from '../components/LogoutButton';
import { getArticulosAprobados, getArticulosPendientes } from '../lib/supabase';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let articulos = [];
  let articulosAprobados = [];
  let error = null;

  try {
    [articulos, articulosAprobados] = await Promise.all([
      getArticulosPendientes(),
      getArticulosAprobados(),
    ]);
  } catch (err) {
    error = err.message;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-8 flex flex-col items-center px-1 text-center sm:mb-10 sm:px-2">
          <div className="flex w-full max-w-7xl items-start justify-end">
            <LogoutButton />
          </div>
          <p className="text-xs font-semibold uppercase leading-relaxed tracking-[0.12em] text-slate-700 sm:text-sm sm:tracking-[0.2em]">
            PANEL SAEZ&amp;NAVES MEDIA GROUP
          </p>
          <img
            src="https://saeznaves.com/wp-content/uploads/2025/12/saeznaves-300x85.png"
            alt="SAEZ & NAVES"
            width={300}
            height={85}
            className="mt-3 h-auto w-[min(100%,260px)] sm:mt-4 sm:w-[300px]"
          />
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
            <p className="text-lg font-semibold sm:text-base">No se pudieron cargar los artículos</p>
            <p className="mt-1 text-base sm:text-sm">{error}</p>
          </div>
        ) : (
          <ArticleDashboard
            articulos={articulos}
            articulosAprobados={articulosAprobados}
          />
        )}
      </div>
    </main>
  );
}
