'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [salindo, setSalindo] = useState(false);

  async function handleLogout() {
    setSalindo(true);

    try {
      await fetch('/api/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } finally {
      setSalindo(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={salindo}
      className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 sm:px-4 sm:py-2"
    >
      {salindo ? 'Saliendo...' : 'Cerrar sesión'}
    </button>
  );
}
