export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Cargando dashboard...
          </p>
        </div>
      </div>
    </main>
  );
}
