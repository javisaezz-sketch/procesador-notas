'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import ContentModal from './ContentModal';
import PublishModal from './PublishModal';
import MedioLogo, { MedioBadge } from './MedioLogo';
import { agruparPorMedio, getMedioTheme, ordenarMedios } from '@/lib/medios';

function mensajeEmailBuzon(emailBuzon) {
  if (!emailBuzon) return '';

  if (emailBuzon.eliminado) {
    return ' Email eliminado del buzón.';
  }

  if (emailBuzon.motivo === 'no_encontrado_en_buzon') {
    return ' El email ya no estaba en el buzón.';
  }

  if (emailBuzon.motivo === 'sin_message_id') {
    return ' No se pudo localizar el email original (sin Message-ID).';
  }

  if (emailBuzon.error) {
    return ` No se pudo borrar el email del buzón: ${emailBuzon.error}`;
  }

  return '';
}

function formatFecha(fecha) {
  if (!fecha) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(fecha));
}

function getMedioNombre(articulo) {
  return articulo.medios?.nombre ?? 'Medio sin nombre';
}

function ArticleCard({ articulo, isPublishing, isAnulando, onView, onPublish, onCancel }) {
  const theme = getMedioTheme(articulo.medios);

  return (
    <div
      className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 sm:p-6 ${theme.accent}`}
    >
      <div className="mb-4">
        <MedioBadge medio={articulo.medios} />
      </div>

      <h2 className="text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">
        {articulo.titulo_generado}
      </h2>

      {articulo.imagen_destacada_url && (
        <img
          src={articulo.imagen_destacada_url}
          alt="Imagen destacada"
          className="mt-4 h-48 w-full rounded-xl object-cover sm:h-40"
        />
      )}

      <div className="mt-4 space-y-2 text-base text-slate-600 sm:text-sm">
        <p>
          <span className="font-medium text-slate-800">Medio:</span>{' '}
          {getMedioNombre(articulo)}
        </p>
        <p>
          <span className="font-medium text-slate-800">Creado:</span>{' '}
          {formatFecha(articulo.fecha_creacion)}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onView}
            disabled={isPublishing || isAnulando}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:py-2.5 sm:text-sm"
          >
            Ver contenido
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={isPublishing || isAnulando}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-400 sm:py-2.5 sm:text-sm"
          >
            {isPublishing ? 'Publicando...' : 'Aprobar y publicar'}
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPublishing || isAnulando}
          className="rounded-xl border border-red-200 px-4 py-3.5 text-base font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 sm:py-2.5 sm:text-sm"
        >
          {isAnulando ? 'Anulando...' : 'Anular'}
        </button>
      </div>
    </div>
  );
}

export default function ArticleDashboard({ articulos = [] }) {
  const router = useRouter();
  const [items, setItems] = useState(articulos);
  const [filtroMedio, setFiltroMedio] = useState('todos');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [publishArticle, setPublishArticle] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [publishingId, setPublishingId] = useState(null);
  const [anulandoId, setAnulandoId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setItems(articulos);
  }, [articulos]);

  const mediosDisponibles = useMemo(() => {
    const map = new Map();

    for (const articulo of items) {
      if (!articulo.medio_id || !articulo.medios) continue;
      map.set(articulo.medio_id, articulo.medios);
    }

    return ordenarMedios(
      [...map.entries()].map(([id, medio]) => ({ id, ...medio })),
    );
  }, [items]);

  const itemsFiltrados = useMemo(() => {
    if (filtroMedio === 'todos') return items;
    return items.filter((item) => String(item.medio_id) === filtroMedio);
  }, [items, filtroMedio]);

  const grupos = useMemo(
    () => (filtroMedio === 'todos' ? agruparPorMedio(itemsFiltrados) : []),
    [itemsFiltrados, filtroMedio],
  );

  function openContentModal(articulo) {
    setSelectedArticle(articulo);
    setEditedContent(articulo.contenido_generado ?? '');
  }

  function closeContentModal() {
    setSelectedArticle(null);
    setEditedContent('');
  }

  async function handlePublicar(articulo, categoriaSlug) {
    setPublishingId(articulo.id);
    setFeedback({
      type: 'info',
      message: `Publicando "${articulo.titulo_generado}" en ${getMedioNombre(articulo)}...`,
    });

    try {
      const response = await fetch(`/api/articulos/${articulo.id}/publicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoriaSlug }),
      });

      const raw = await response.text();
      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw || 'Respuesta inválida del servidor');
      }

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo publicar el artículo');
      }

      setItems((prev) => prev.filter((item) => item.id !== articulo.id));
      setPublishArticle(null);
      setFeedback({
        type: 'success',
        message:
          `Publicado en ${data.medio} → categoría "${data.categoria}"${data.imagenDestacada ? ' con imagen destacada' : ''}${data.emailNotificacion ? ` · Notificar a ${data.emailNotificacion}` : ''}.${mensajeEmailBuzon(data.emailBuzon)}`,
      });
      router.refresh();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setPublishingId(null);
    }
  }

  async function handleAnular(articulo) {
    const confirmar = window.confirm(
      `¿Anular "${articulo.titulo_generado}"?\n\nDesaparecerá del panel y no se publicará en WordPress.`,
    );

    if (!confirmar) return;

    setAnulandoId(articulo.id);
    setFeedback({
      type: 'info',
      message: `Anulando "${articulo.titulo_generado}"...`,
    });

    try {
      const response = await fetch(`/api/articulos/${articulo.id}/anular`, {
        method: 'POST',
      });

      const raw = await response.text();
      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw || 'Respuesta inválida del servidor');
      }

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo anular el artículo');
      }

      setItems((prev) => prev.filter((item) => item.id !== articulo.id));
      setFeedback({
        type: 'success',
        message: `Artículo anulado. Ya no aparecerá en la cola de revisión.${mensajeEmailBuzon(data.articulo?.emailBuzon ?? data.emailBuzon)}`,
      });
      router.refresh();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setAnulandoId(null);
    }
  }

  function renderCards(lista) {
    return (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((articulo) => {
          const isPublishing = publishingId === articulo.id;
          const isAnulando = anulandoId === articulo.id;

          return (
            <ArticleCard
              key={articulo.id}
              articulo={articulo}
              isPublishing={isPublishing}
              isAnulando={isAnulando}
              onView={() => openContentModal(articulo)}
              onPublish={() => setPublishArticle(articulo)}
              onCancel={() => handleAnular(articulo)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <>
      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600 sm:text-sm">
            Panel editorial
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-3xl">
            Artículos pendientes de revisión
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600 sm:text-base">
            Revisa el contenido por medio, elige categoría y publica como borrador en WordPress.
          </p>
        </div>
        <div className="inline-flex w-fit shrink-0 items-center rounded-full bg-indigo-50 px-5 py-2.5 text-base font-medium text-indigo-700 ring-1 ring-indigo-100 sm:px-4 sm:py-2 sm:text-sm">
          {items.length} pendiente{items.length === 1 ? '' : 's'}
          {mediosDisponibles.length > 1 && (
            <span className="ml-2 text-indigo-500">
              · {mediosDisponibles.length} medios
            </span>
          )}
        </div>
      </section>

      {mediosDisponibles.length > 1 && (
        <div className="-mx-3 mb-6 flex gap-2.5 overflow-x-auto px-3 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <button
            type="button"
            onClick={() => setFiltroMedio('todos')}
            className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
              filtroMedio === 'todos'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Todos ({items.length})
          </button>

          {mediosDisponibles.map((medio) => {
            const theme = getMedioTheme(medio);
            const count = items.filter((item) => item.medio_id === medio.id).length;

            return (
              <button
                key={medio.id}
                type="button"
                onClick={() => setFiltroMedio(String(medio.id))}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                  filtroMedio === String(medio.id)
                    ? `${theme.badge} border-transparent`
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <MedioLogo medio={medio} size="xs" />
                <span>{medio.nombre}</span>
                <span className="shrink-0 text-slate-500">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {feedback && (
        <div
          className={`mb-6 rounded-2xl px-5 py-4 text-base sm:text-sm ${
            feedback.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : feedback.type === 'info'
                ? 'border border-blue-200 bg-blue-50 text-blue-800'
                : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {itemsFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="text-xl font-semibold text-slate-900 sm:text-lg">
            No hay artículos pendientes
          </p>
          {filtroMedio !== 'todos' && (
            <button
              type="button"
              onClick={() => setFiltroMedio('todos')}
              className="mt-4 text-base font-medium text-indigo-600 hover:text-indigo-700 sm:text-sm"
            >
              Ver todos los medios
            </button>
          )}
        </div>
      ) : filtroMedio === 'todos' && grupos.length > 1 ? (
        <div className="space-y-10">
          {grupos.map((grupo) => (
              <section key={grupo.medio?.id ?? grupo.medio?.nombre}>
                <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
                  <MedioLogo medio={grupo.medio} size="md" />
                  <h2 className="text-xl font-bold text-slate-900 sm:text-xl">
                    {grupo.medio?.nombre ?? 'Sin medio'}
                  </h2>
                  <span className="text-sm text-slate-500 sm:text-sm">
                    {grupo.articulos.length} artículo
                    {grupo.articulos.length === 1 ? '' : 's'}
                  </span>
                </div>
                {renderCards(grupo.articulos)}
              </section>
          ))}
        </div>
      ) : (
        renderCards(itemsFiltrados)
      )}

      {selectedArticle && (
        <ContentModal
          articulo={selectedArticle}
          content={editedContent}
          onContentChange={setEditedContent}
          onClose={closeContentModal}
        />
      )}

      {publishArticle && (
        <PublishModal
          articulo={publishArticle}
          isPublishing={publishingId === publishArticle.id}
          onClose={() => setPublishArticle(null)}
          onConfirm={(categoriaSlug) => handlePublicar(publishArticle, categoriaSlug)}
        />
      )}
    </>
  );
}
