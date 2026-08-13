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
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="mb-8 text-center">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-slate-700 sm:text-xs sm:tracking-[0.2em]">
            PANEL SAEZ&amp;NAVES MEDIA GROUP
          </p>
          <img
            src="https://saeznaves.com/wp-content/uploads/2025/12/saeznaves-300x85.png"
            alt="SAEZ & NAVES"
            width={300}
            height={85}
            className="mx-auto mt-3 h-auto w-[min(100%,220px)] sm:mt-4 sm:w-[240px]"
          />
          <h1 className="mt-6 text-xl font-bold text-slate-900">Acceso al panel</h1>
          <p className="mt-2 text-sm text-slate-600">
            Introduce tus credenciales para revisar y publicar artículos.
          </p>
        </header>

        <form className="space-y-4" onSubmit={handleSubmit} autoComplete="on">
          <div>
            <label
              htmlFor="usuario"
              className="mb-1.5 block text-sm font-medium text-slate-700"
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
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-indigo-500 focus:ring-2"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
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
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-indigo-500 focus:ring-2"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={recordar}
              onChange={(event) => setRecordar(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Recordarme en este dispositivo (30 días)
          </label>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-400"
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
