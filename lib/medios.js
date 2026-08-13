import { CATEGORIAS_WORDPRESS } from './categorias';

export const MEDIO_COLOR_CLASSES = {
  indigo: {
    badge: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
    tab: 'border-indigo-600 text-indigo-700',
    accent: 'border-l-indigo-500',
    dot: 'bg-indigo-500',
  },
  emerald: {
    badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    tab: 'border-emerald-600 text-emerald-700',
    accent: 'border-l-emerald-500',
    dot: 'bg-emerald-500',
  },
  amber: {
    badge: 'bg-amber-100 text-amber-800 ring-amber-200',
    tab: 'border-amber-600 text-amber-700',
    accent: 'border-l-amber-500',
    dot: 'bg-amber-500',
  },
  rose: {
    badge: 'bg-rose-100 text-rose-800 ring-rose-200',
    tab: 'border-rose-600 text-rose-700',
    accent: 'border-l-rose-500',
    dot: 'bg-rose-500',
  },
  violet: {
    badge: 'bg-violet-100 text-violet-800 ring-violet-200',
    tab: 'border-violet-600 text-violet-700',
    accent: 'border-l-violet-500',
    dot: 'bg-violet-500',
  },
};

const DEFAULT_THEME = MEDIO_COLOR_CLASSES.indigo;

export function getMedioTheme(medio) {
  const color = medio?.color || 'indigo';
  return MEDIO_COLOR_CLASSES[color] ?? DEFAULT_THEME;
}

export function getCategoriasMedio(medio) {
  const raw = medio?.categorias_json;

  if (Array.isArray(raw) && raw.length > 0) {
    return raw;
  }

  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fallback abajo
    }
  }

  return CATEGORIAS_WORDPRESS;
}

export const WP_META_NOTIFICACION = {
  travelicius: '_trv_target_email',
  vidaystyle: '_vs_target_emails',
  glamcloset: '_gc_target_email',
  femnegoci: '_fn_target_email',
};

export const WP_NOTIFY_COMMENT = {
  travelicius: 'TRV_NOTIFY',
  vidaystyle: 'VS_NOTIFY',
  glamcloset: 'GC_NOTIFY',
  femnegoci: 'FN_NOTIFY',
};

export const MEDIO_LOGOS = {
  travelicius:
    'https://travelicius.es/wp-content/uploads/2025/11/traveliciuslogo_blanco_p.webp',
  vidaystyle:
    'https://vidaystyle.com/wp-content/uploads/2020/04/cropped-logo-vs-frontalp-1-e1586855601238.png',
  glamcloset:
    'https://glamcloset.cat/wp-content/uploads/2025/04/GLAMCLOSET_LOGOg-150x150-1.webp',
  femnegoci:
    'https://femnegoci.es/wp-content/uploads/2025/10/cropped-logowebfemnegoci.jpg',
};

export const MEDIO_ORDEN_SLUGS = [
  'glamcloset',
  'travelicius',
  'vidaystyle',
  'femnegoci',
];

export function compararMedios(a, b) {
  const indiceA = MEDIO_ORDEN_SLUGS.indexOf(a?.slug);
  const indiceB = MEDIO_ORDEN_SLUGS.indexOf(b?.slug);
  const pesoA = indiceA === -1 ? 999 : indiceA;
  const pesoB = indiceB === -1 ? 999 : indiceB;

  if (pesoA !== pesoB) {
    return pesoA - pesoB;
  }

  return (a?.nombre || '').localeCompare(b?.nombre || '', 'es');
}

export function ordenarMedios(medios) {
  return [...medios].sort(compararMedios);
}

export function indiceOrdenMedio(medio) {
  const indice = MEDIO_ORDEN_SLUGS.indexOf(medio?.slug);
  return indice === -1 ? 999 : indice;
}

const MEDIO_LOGO_FONDO_OSCURO = new Set(['travelicius']);

export function getMedioLogo(medio) {
  const slug = medio?.slug;
  return slug ? MEDIO_LOGOS[slug] ?? null : null;
}

export function medioLogoUsaFondoOscuro(medio) {
  return MEDIO_LOGO_FONDO_OSCURO.has(medio?.slug);
}

export function getMetaNotificacionWordPress(medio) {
  const slug = medio?.slug;
  return slug ? WP_META_NOTIFICACION[slug] ?? null : null;
}

export function getNotifyCommentPrefix(medio) {
  const slug = medio?.slug;
  return slug ? WP_NOTIFY_COMMENT[slug] ?? null : null;
}

export function agruparPorMedio(articulos) {
  const grupos = new Map();

  for (const articulo of articulos) {
    const medioId = articulo.medio_id ?? 'sin-medio';
    if (!grupos.has(medioId)) {
      grupos.set(medioId, {
        medio: articulo.medios ?? { nombre: 'Sin medio', color: 'indigo' },
        articulos: [],
      });
    }
    grupos.get(medioId).articulos.push(articulo);
  }

  const lista = [...grupos.values()];
  return lista.sort((a, b) => compararMedios(a.medio, b.medio));
}
