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
      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:text-sm"
    >
      {salindo ? 'Saliendo...' : 'Cerrar sesión'}
    </button>
  );
}
