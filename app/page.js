import ArticleDashboard from '../components/ArticleDashboard';
import LogoutButton from '../components/LogoutButton';
import PipelineStatusBanner from '../components/PipelineStatusBanner';
import {
  getArticulosAprobados,
  getArticulosPendientes,
  getGoogleMapsReviews,
  getMediosPanel,
  getNotasConError,
} from '../lib/supabase';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let articulos = [];
  let articulosAprobados = [];
  let notasConError = [];
  let medios = [];
  let googleMapsReviews = [];
  let error = null;

  try {
    [articulos, articulosAprobados, notasConError, medios, googleMapsReviews] = await Promise.all([
      getArticulosPendientes(),
      getArticulosAprobados(),
      getNotasConError(),
      getMediosPanel(),
      getGoogleMapsReviews(),
    ]);
  } catch (err) {
    error = err.message;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <header className="relative mb-8 flex flex-col items-center px-1 text-center sm:mb-10 sm:px-2">
          <div className="flex w-full items-center justify-between pb-4 sm:pb-6">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" title="Sistema activo" />
              <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">Online</span>
            </div>
            <LogoutButton />
          </div>

          <div className="flex flex-col items-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-1.5 shadow-sm mb-3">
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-indigo-600 sm:text-xs">
                Panel de Control Editorial
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              SÁEZ <span className="text-indigo-600">&amp;</span> NAVES
              <span className="block mt-1 text-sm font-semibold tracking-[0.3em] uppercase text-slate-500 sm:text-base sm:tracking-[0.35em]">
                Media Group
              </span>
            </h1>
            <div className="mt-3.5 h-1 w-20 rounded-full bg-gradient-to-r from-indigo-500 via-rose-500 to-pink-500" />
          </div>
        </header>

        <PipelineStatusBanner />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
            <p className="text-lg font-semibold sm:text-base">No se pudieron cargar los artículos</p>
            <p className="mt-1 text-base sm:text-sm">{error}</p>
          </div>
        ) : (
          <ArticleDashboard
            articulos={articulos}
            articulosAprobados={articulosAprobados}
            notasConError={notasConError}
            medios={medios}
            googleMapsReviews={googleMapsReviews}
          />
        )}
      </div>
    </main>
  );
}
