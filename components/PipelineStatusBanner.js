'use client';

import { useEffect, useState } from 'react';

function formatFecha(fecha) {
  if (!fecha) return null;

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(fecha));
}

function resumirAdvertencias(advertencias = []) {
  if (!advertencias.length) return null;

  const partes = [];

  for (const item of advertencias.slice(0, 3)) {
    if (item.medio) {
      partes.push(`POP3 ${item.medio}`);
    } else if (item.notaId) {
      partes.push(`Gemini nota #${item.notaId}`);
    }
  }

  const extra = advertencias.length - partes.length;
  const base = partes.join(', ');

  if (extra > 0) {
    return `${base} y ${extra} más`;
  }

  return base;
}

function resumirFatal(fatal) {
  if (!fatal) return 'Error desconocido en el pipeline';

  if (fatal.fase === 'pop3') {
    return fatal.error || 'Error leyendo buzones de correo';
  }

  if (fatal.fase === 'gemini') {
    return fatal.error || 'Error procesando notas con Gemini';
  }

  return fatal.error || 'Error en el pipeline automático';
}

export default function PipelineStatusBanner() {
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        const response = await fetch('/api/pipeline/ultimo', { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));

        if (!activo) return;

        if (response.ok && data.ok) {
          setEstado(data.estado ?? null);
        }
      } catch {
        if (activo) {
          setEstado(null);
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargar();
    const interval = setInterval(cargar, 60000);

    return () => {
      activo = false;
      clearInterval(interval);
    };
  }, []);

  if (cargando || !estado) {
    return null;
  }

  const fecha = formatFecha(estado.ejecutado_en);
  const advertencias = Array.isArray(estado.advertencias) ? estado.advertencias : [];
  const resumenAvisos = resumirAdvertencias(advertencias);

  let tone = 'ok';
  let titulo = 'Último pipeline completado correctamente';
  let detalle = fecha
    ? `Ejecutado ${fecha}. ${estado.emails_nuevas ?? 0} email(s) nuevos, ${estado.articulos_generados ?? 0} artículo(s) generados.`
    : 'Pipeline ejecutado correctamente.';

  if (!estado.ok) {
    tone = 'error';
    titulo = 'Último pipeline fallido';
    detalle = `${resumirFatal(estado.fatal)}${fecha ? ` · ${fecha}` : ''}`;
  } else if (advertencias.length) {
    tone = 'warn';
    titulo = 'Último pipeline completado con avisos';
    detalle = `${resumenAvisos}${fecha ? ` · ${fecha}` : ''}`;
  }

  const clases =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-emerald-200 bg-emerald-50 text-emerald-900';

  return (
    <div className={`mb-6 rounded-2xl border px-5 py-4 ${clases}`}>
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="mt-1 text-sm opacity-90">{detalle}</p>
    </div>
  );
}
