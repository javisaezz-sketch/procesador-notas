'use client';

import {
  getMedioLogo,
  getMedioTheme,
  medioLogoUsaFondoOscuro,
} from '@/lib/medios';

const TAMANOS = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

export default function MedioLogo({ medio, size = 'sm', className = '' }) {
  const logo = getMedioLogo(medio);
  const theme = getMedioTheme(medio);
  const fondoOscuro = medioLogoUsaFondoOscuro(medio);
  const box = TAMANOS[size] ?? TAMANOS.sm;

  if (!logo) {
    return (
      <span
        className={`inline-block shrink-0 rounded-full ${box} ${theme.dot} ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg ${box} ${
        fondoOscuro ? 'bg-slate-900' : 'bg-white ring-1 ring-slate-200'
      } ${className}`}
    >
      <img
        src={logo}
        alt={medio?.nombre ? `Logo ${medio.nombre}` : 'Logo del medio'}
        className="h-full w-full object-contain p-0.5"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

export function MedioBadge({ medio, compact = false, className = '' }) {
  const theme = getMedioTheme(medio);

  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 sm:px-3 sm:py-1 ${theme.badge} ${className}`}
    >
      <MedioLogo medio={medio} size="sm" />
      {!compact && (
        <span className="truncate">{medio?.nombre ?? 'Sin medio'}</span>
      )}
    </span>
  );
}
