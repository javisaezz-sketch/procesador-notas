import ArticleDashboard from '../components/ArticleDashboard';
import { getArticulosPendientes } from '../lib/supabase';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let articulos = [];
  let error = null;

  try {
    articulos = await getArticulosPendientes();
  } catch (err) {
    error = err.message;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-8 flex flex-col items-center px-2 text-center sm:mb-10">
          <p className="text-[0.65rem] font-semibold uppercase leading-relaxed tracking-[0.15em] text-slate-700 sm:text-sm sm:tracking-[0.2em]">
            PANEL SAEZ&amp;NAVES MEDIA GROUP
          </p>
          <img
            src="https://saeznaves.com/wp-content/uploads/2025/12/saeznaves-300x85.png"
            alt="SAEZ & NAVES"
            width={300}
            height={85}
            className="mt-3 h-auto w-[min(100%,220px)] sm:mt-4 sm:w-[300px]"
          />
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
            <p className="font-semibold">No se pudieron cargar los artículos</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        ) : (
          <ArticleDashboard articulos={articulos} />
        )}
      </div>
    </main>
  );
}
