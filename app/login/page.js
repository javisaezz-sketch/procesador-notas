'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setEnviando(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password, recordar }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo iniciar sesión');
      }

      const destino = searchParams.get('from') || '/';
      router.replace(destino);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
        <header className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 mb-4 shadow-sm">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-indigo-600 sm:text-xs">
              Panel de Control Editorial
            </span>
          </div>

          <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            SÁEZ <span className="text-indigo-600">&amp;</span> NAVES
            <span className="block mt-1 text-xs font-semibold tracking-[0.25em] uppercase text-slate-500 sm:text-sm">
              Media Group
            </span>
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-indigo-500 via-rose-500 to-pink-500" />

          <h1 className="mt-6 text-xl font-bold text-slate-900 sm:text-lg">Acceso al panel</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Introduce tus credenciales para revisar y publicar artículos.
          </p>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit} autoComplete="on">
          <div>
            <label
              htmlFor="usuario"
              className="mb-2 block text-base font-medium text-slate-700 sm:text-sm"
            >
              Usuario
            </label>
            <input
              id="usuario"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={usuario}
              onChange={(event) => setUsuario(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base outline-none ring-indigo-500 focus:ring-2 sm:py-3 sm:text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-base font-medium text-slate-700 sm:text-sm"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base outline-none ring-indigo-500 focus:ring-2 sm:py-3 sm:text-sm"
            />
          </div>

          <label className="flex items-center gap-3 text-base text-slate-600 sm:text-sm">
            <input
              type="checkbox"
              checked={recordar}
              onChange={(event) => setRecordar(event.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-indigo-600 sm:h-4 sm:w-4"
            />
            Recordarme en este dispositivo (30 días)
          </label>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-base text-red-700 sm:text-sm">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-xl bg-indigo-600 px-4 py-4 text-base font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-400 sm:py-3 sm:text-sm"
          >
            {enviando ? 'Entrando...' : 'Entrar al panel'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-600">Cargando...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
