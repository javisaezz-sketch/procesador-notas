'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import ContentModal from './ContentModal';
import PublishModal from './PublishModal';
import ApprovedArticleCard from './ApprovedArticleCard';
import ErrorNotaCard from './ErrorNotaCard';
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
            {isPublishing ? 'Publicando...' : 'Aprobar'}
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

export default function ArticleDashboard({
  articulos = [],
  articulosAprobados = [],
  notasConError = [],
}) {
  const router = useRouter();
  const [vistaPanel, setVistaPanel] = useState('pendientes');
  const [items, setItems] = useState(articulos);
  const [approvedItems, setApprovedItems] = useState(articulosAprobados);
  const [errorItems, setErrorItems] = useState(notasConError);
  const [filtroMedio, setFiltroMedio] = useState('todos');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [publishArticle, setPublishArticle] = useState(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [imagenesNota, setImagenesNota] = useState([]);
  const [destacadaUrl, setDestacadaUrl] = useState(null);
  const [publicarUrls, setPublicarUrls] = useState([]);
  const [imagenesCargando, setImagenesCargando] = useState(false);
  const [guardandoId, setGuardandoId] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [publishingId, setPublishingId] = useState(null);
  const [publishingWebId, setPublishingWebId] = useState(null);
  const [anulandoId, setAnulandoId] = useState(null);
  const [reintentandoId, setReintentandoId] = useState(null);
  const [descartandoId, setDescartandoId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  useEffect(() => {
    setItems(articulos);
  }, [articulos]);

  useEffect(() => {
    setApprovedItems(articulosAprobados);
  }, [articulosAprobados]);

  useEffect(() => {
    setErrorItems(notasConError);
  }, [notasConError]);

  useEffect(() => {
    const modalAbierto = Boolean(selectedArticle || publishArticle);
    if (modalAbierto) return undefined;

    const interval = setInterval(() => {
      router.refresh();
      setUltimaActualizacion(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [router, selectedArticle, publishArticle]);

  const listaActiva =
    vistaPanel === 'pendientes'
      ? items
      : vistaPanel === 'aprobados'
        ? approvedItems
        : errorItems;

  const mediosDisponibles = useMemo(() => {
    const map = new Map();

    for (const articulo of listaActiva) {
      if (!articulo.medio_id || !articulo.medios) continue;
      map.set(articulo.medio_id, articulo.medios);
    }

    return ordenarMedios(
      [...map.entries()].map(([id, medio]) => ({ id, ...medio })),
    );
  }, [listaActiva]);

  const itemsFiltrados = useMemo(() => {
    if (filtroMedio === 'todos') return listaActiva;
    return listaActiva.filter((item) => String(item.medio_id) === filtroMedio);
  }, [listaActiva, filtroMedio]);

  const grupos = useMemo(
    () =>
      filtroMedio === 'todos' &&
      (vistaPanel === 'pendientes' ||
        vistaPanel === 'aprobados' ||
        vistaPanel === 'errores')
        ? agruparPorMedio(itemsFiltrados)
        : [],
    [itemsFiltrados, filtroMedio, vistaPanel],
  );

  const borradoresPendientesWeb = approvedItems.length;

  function openContentModal(articulo) {
    setSelectedArticle(articulo);
    setEditedTitle(articulo.titulo_generado ?? '');
    setEditedContent(articulo.contenido_generado ?? '');
    setEditedEmail(articulo.email_notificacion ?? '');
    setSaveError('');
    setImagenesNota([]);
    setDestacadaUrl(articulo.imagen_destacada_url ?? null);
    setPublicarUrls(
      Array.isArray(articulo.imagenes_publicar_urls)
        ? articulo.imagenes_publicar_urls
        : [],
    );
    setImagenesCargando(true);

    fetch(`/api/articulos/${articulo.id}/imagenes`)
      .then((response) => response.json())
      .then((data) => {
        if (!data.ok) {
          throw new Error(data.error || 'No se pudieron cargar las imágenes');
        }

        setImagenesNota(data.imagenes ?? []);
        setDestacadaUrl(data.imagen_destacada_url ?? null);
        setPublicarUrls(data.imagenes_publicar_urls ?? []);
      })
      .catch((error) => {
        setSaveError(error.message);
      })
      .finally(() => {
        setImagenesCargando(false);
      });
  }

  function closeContentModal() {
    setSelectedArticle(null);
    setEditedTitle('');
    setEditedContent('');
    setEditedEmail('');
    setImagenesNota([]);
    setDestacadaUrl(null);
    setPublicarUrls([]);
    setSaveError('');
  }

  async function handleGuardar(articulo) {
    setGuardandoId(articulo.id);
    setSaveError('');

    try {
      const response = await fetch(`/api/articulos/${articulo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo_generado: editedTitle,
          contenido_generado: editedContent,
          ...(articulo.sin_notificacion
            ? {}
            : { email_notificacion: editedEmail }),
          imagen_destacada_url: destacadaUrl,
          imagenes_publicar_urls: publicarUrls,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo guardar el artículo');
      }

      const actualizado = data.articulo;
      const galeriaCount = Math.max(
        (actualizado.imagenes_publicar_urls?.length ?? publicarUrls.length) - 1,
        0,
      );

      setItems((prev) =>
        prev.map((item) =>
          item.id === articulo.id
            ? {
                ...item,
                titulo_generado: actualizado.titulo_generado,
                contenido_generado: actualizado.contenido_generado,
                email_notificacion:
                  actualizado.email_notificacion ?? editedEmail,
                imagen_destacada_url:
                  actualizado.imagen_destacada_url ?? destacadaUrl,
                imagenes_publicar_urls:
                  actualizado.imagenes_publicar_urls ?? publicarUrls,
                imagenes_adicionales: galeriaCount,
              }
            : item,
        ),
      );

      setSelectedArticle((prev) =>
        prev?.id === articulo.id
          ? {
              ...prev,
              titulo_generado: actualizado.titulo_generado,
              contenido_generado: actualizado.contenido_generado,
              email_notificacion:
                actualizado.email_notificacion ?? editedEmail,
              imagen_destacada_url:
                actualizado.imagen_destacada_url ?? destacadaUrl,
              imagenes_publicar_urls:
                actualizado.imagenes_publicar_urls ?? publicarUrls,
              imagenes_adicionales: galeriaCount,
            }
          : prev,
      );

      setFeedback({
        type: 'success',
        message: `Cambios guardados en "${actualizado.titulo_generado}".`,
      });
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setGuardandoId(null);
    }
  }

  function buildApprovedItem(articulo, data, publicadoEnWeb) {
    return {
      ...articulo,
      estado: 'publicado',
      wp_post_id: data.wordpressPostId ?? data.articulo?.wp_post_id ?? articulo.wp_post_id,
      wp_post_url:
        data.wordpressPostUrl ??
        data.articulo?.wp_post_url ??
        articulo.wp_post_url,
      wp_post_status: publicadoEnWeb
        ? 'publish'
        : data.articulo?.wp_post_status ?? 'draft',
    };
  }

  async function handlePublicar(articulo, categoriaSlug, { publicarEnWeb = false } = {}) {
    setPublishingId(articulo.id);
    setFeedback({
      type: 'info',
      message: publicarEnWeb
        ? `Publicando "${articulo.titulo_generado}" en la web...`
        : `Enviando "${articulo.titulo_generado}" como borrador a ${getMedioNombre(articulo)}...`,
    });

    try {
      const response = await fetch(`/api/articulos/${articulo.id}/publicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoriaSlug, publicarEnWeb }),
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

      if (publicarEnWeb) {
        setApprovedItems((prev) => prev.filter((item) => item.id !== articulo.id));
        setFeedback({
          type: 'success',
          message: `Publicado en ${data.medio} → categoría "${data.categoria}". Ya está visible en la web.${data.emailNotificacion ? ` Notificación a ${data.emailNotificacion}.` : ''}${mensajeEmailBuzon(data.emailBuzon)}`,
          link: data.wordpressPostUrl,
          linkLabel: 'Ver artículo publicado',
        });
      } else {
        const aprobado = buildApprovedItem(articulo, data, false);
        setApprovedItems((prev) => {
          const sinDuplicado = prev.filter((item) => item.id !== articulo.id);
          return [aprobado, ...sinDuplicado];
        });
        setVistaPanel('aprobados');
        setFeedback({
          type: 'success',
          message: `Borrador creado en ${data.medio} → categoría "${data.categoria}". Puedes publicarlo en la web desde la pestaña Aprobados.${data.emailNotificacion ? ` Notificará a ${data.emailNotificacion} al publicar.` : ''}${mensajeEmailBuzon(data.emailBuzon)}`,
          link: data.wordpressPostUrl,
          linkLabel: 'Ver borrador en WordPress',
        });
      }

      router.refresh();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setPublishingId(null);
    }
  }

  async function handlePublicarEnWeb(articulo) {
    const confirmar = window.confirm(
      `¿Publicar "${articulo.titulo_generado}" en ${getMedioNombre(articulo)}?\n\nPasará de borrador a publicado en la web.`,
    );

    if (!confirmar) return;

    setPublishingWebId(articulo.id);
    setFeedback({
      type: 'info',
      message: `Publicando "${articulo.titulo_generado}" en la web...`,
    });

    try {
      const response = await fetch(`/api/articulos/${articulo.id}/publicar-en-web`, {
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
        throw new Error(data.error || 'No se pudo publicar en la web');
      }

      setApprovedItems((prev) => prev.filter((item) => item.id !== articulo.id));

      setFeedback({
        type: 'success',
        message: `Publicado en ${data.medio}. Ya está visible en la web.`,
        link: data.wordpressPostUrl,
        linkLabel: 'Ver artículo publicado',
      });
      router.refresh();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setPublishingWebId(null);
    }
  }

  async function handleReintentarNota(nota) {
    setReintentandoId(nota.id);
    setFeedback({
      type: 'info',
      message: `Reintentando nota #${nota.id}...`,
    });

    try {
      const response = await fetch(`/api/notas/${nota.id}/reintentar`, {
        method: 'POST',
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo reintentar la nota');
      }

      setErrorItems((prev) => prev.filter((item) => item.id !== nota.id));
      setFeedback({
        type: 'success',
        message:
          'Nota devuelta a la cola. El pipeline la procesará en los próximos minutos.',
      });
      router.refresh();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setReintentandoId(null);
    }
  }

  async function handleDescartarNota(nota) {
    const confirmar = window.confirm(
      `¿Descartar esta nota?\n\nNo se procesará con IA ni volverá a aparecer en Errores IA.`,
    );

    if (!confirmar) return;

    setDescartandoId(nota.id);

    try {
      const response = await fetch(`/api/notas/${nota.id}/descartar`, {
        method: 'POST',
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo descartar la nota');
      }

      setErrorItems((prev) => prev.filter((item) => item.id !== nota.id));
      setFeedback({
        type: 'success',
        message: 'Nota descartada.',
      });
      router.refresh();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setDescartandoId(null);
    }
  }

  async function handleAnular(articulo) {
    const esAprobado = articulo.estado === 'publicado';
    const confirmar = window.confirm(
      esAprobado
        ? `¿Eliminar "${articulo.titulo_generado}" del panel?\n\nDesaparecerá de la lista de borradores. El contenido en WordPress no se borra automáticamente.`
        : `¿Anular "${articulo.titulo_generado}"?\n\nDesaparecerá del panel y no se publicará en WordPress.`,
    );

    if (!confirmar) return;

    setAnulandoId(articulo.id);
    setFeedback({
      type: 'info',
      message: `Eliminando "${articulo.titulo_generado}"...`,
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
        throw new Error(data.error || 'No se pudo eliminar el artículo');
      }

      if (esAprobado) {
        setApprovedItems((prev) => prev.filter((item) => item.id !== articulo.id));
      } else {
        setItems((prev) => prev.filter((item) => item.id !== articulo.id));
      }

      setFeedback({
        type: 'success',
        message: esAprobado
          ? `Artículo eliminado del panel.${mensajeEmailBuzon(data.articulo?.emailBuzon ?? data.emailBuzon)}`
          : `Artículo anulado. Ya no aparecerá en la cola de revisión.${mensajeEmailBuzon(data.articulo?.emailBuzon ?? data.emailBuzon)}`,
      });
      router.refresh();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setAnulandoId(null);
    }
  }

  function renderErrorCards(lista) {
    return (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((nota) => (
          <ErrorNotaCard
            key={nota.id}
            nota={nota}
            isRetrying={reintentandoId === nota.id || descartandoId === nota.id}
            onRetry={() => handleReintentarNota(nota)}
            onDismiss={() => handleDescartarNota(nota)}
          />
        ))}
      </div>
    );
  }

  function renderApprovedCards(lista) {
    return (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((articulo) => (
          <ApprovedArticleCard
            key={articulo.id}
            articulo={articulo}
            isPublishing={publishingWebId === articulo.id}
            isAnulando={anulandoId === articulo.id}
            onPublishWeb={() => handlePublicarEnWeb(articulo)}
            onDelete={() => handleAnular(articulo)}
          />
        ))}
      </div>
    );
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
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => {
            setVistaPanel('pendientes');
            setFiltroMedio('todos');
          }}
          className={`shrink-0 rounded-full px-5 py-3 text-sm font-semibold transition sm:py-2.5 ${
            vistaPanel === 'pendientes'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Pendientes ({items.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setVistaPanel('aprobados');
            setFiltroMedio('todos');
          }}
          className={`shrink-0 rounded-full px-5 py-3 text-sm font-semibold transition sm:py-2.5 ${
            vistaPanel === 'aprobados'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Aprobados ({approvedItems.length})
          {borradoresPendientesWeb > 0 && (
            <span className="ml-2 opacity-80">
              · {borradoresPendientesWeb} borrador
              {borradoresPendientesWeb === 1 ? '' : 'es'}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setVistaPanel('errores');
            setFiltroMedio('todos');
          }}
          className={`shrink-0 rounded-full px-5 py-3 text-sm font-semibold transition sm:py-2.5 ${
            vistaPanel === 'errores'
              ? 'bg-slate-900 text-white'
              : errorItems.length > 0
                ? 'border border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Errores IA ({errorItems.length})
        </button>
      </div>

      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600 sm:text-sm">
            Panel editorial
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-3xl">
            {vistaPanel === 'pendientes'
              ? 'Artículos pendientes de revisión'
              : vistaPanel === 'aprobados'
                ? 'Borradores aprobados en WordPress'
                : 'Notas con error de procesamiento'}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600 sm:text-base">
            {vistaPanel === 'pendientes'
              ? 'Revisa el contenido, elige categoría y publícalo en la web o déjalo en borrador.'
              : vistaPanel === 'aprobados'
                ? 'Publica en la web los borradores ya aprobados, sin entrar en WordPress.'
                : 'Reintenta las notas que fallaron al generarse con Gemini o descártalas.'}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="inline-flex w-fit shrink-0 items-center rounded-full bg-indigo-50 px-5 py-2.5 text-base font-medium text-indigo-700 ring-1 ring-indigo-100 sm:px-4 sm:py-2 sm:text-sm">
            {vistaPanel === 'pendientes' ? (
              <>
                {items.length} pendiente{items.length === 1 ? '' : 's'}
              </>
            ) : vistaPanel === 'aprobados' ? (
              <>
                {borradoresPendientesWeb} borrador
                {borradoresPendientesWeb === 1 ? '' : 'es'} por publicar
              </>
            ) : (
              <>
                {errorItems.length} error{errorItems.length === 1 ? '' : 'es'}
              </>
            )}
          </div>
          <p className="text-xs text-slate-500 sm:text-right">
            Auto-refresh cada 30 s
            {ultimaActualizacion
              ? ` · ${ultimaActualizacion.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : ''}
          </p>
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
            Todos ({listaActiva.length})
          </button>

          {mediosDisponibles.map((medio) => {
            const theme = getMedioTheme(medio);
            const count = listaActiva.filter((item) => item.medio_id === medio.id).length;

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
          {feedback.link && (
            <a
              href={feedback.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex rounded-xl bg-green-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-green-800 sm:text-sm sm:py-2"
            >
              {feedback.linkLabel || 'Abrir enlace'}
            </a>
          )}
        </div>
      )}

      {itemsFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="text-xl font-semibold text-slate-900 sm:text-lg">
            {vistaPanel === 'pendientes'
              ? 'No hay artículos pendientes'
              : vistaPanel === 'aprobados'
                ? 'No hay artículos aprobados'
                : 'No hay errores de procesamiento'}
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
                {vistaPanel === 'pendientes'
                  ? renderCards(grupo.articulos)
                  : vistaPanel === 'aprobados'
                    ? renderApprovedCards(grupo.articulos)
                    : renderErrorCards(grupo.articulos)}
              </section>
          ))}
        </div>
      ) : vistaPanel === 'pendientes' ? (
        renderCards(itemsFiltrados)
      ) : vistaPanel === 'aprobados' ? (
        renderApprovedCards(itemsFiltrados)
      ) : (
        renderErrorCards(itemsFiltrados)
      )}

      {vistaPanel === 'pendientes' && selectedArticle && (
        <ContentModal
          articulo={selectedArticle}
          title={editedTitle}
          content={editedContent}
          emailNotificacion={editedEmail}
          imagenes={imagenesNota}
          destacadaUrl={destacadaUrl}
          publicarUrls={publicarUrls}
          imagenesCargando={imagenesCargando}
          onTitleChange={setEditedTitle}
          onContentChange={setEditedContent}
          onEmailNotificacionChange={setEditedEmail}
          onDestacadaChange={setDestacadaUrl}
          onPublicarChange={setPublicarUrls}
          onClose={closeContentModal}
          onSave={() => handleGuardar(selectedArticle)}
          isSaving={guardandoId === selectedArticle.id}
          saveError={saveError}
        />
      )}

      {vistaPanel === 'pendientes' && publishArticle && (
        <PublishModal
          articulo={publishArticle}
          isPublishing={publishingId === publishArticle.id}
          onClose={() => setPublishArticle(null)}
          onConfirm={(categoriaSlug, opciones) =>
            handlePublicar(publishArticle, categoriaSlug, opciones)
          }
        />
      )}
    </>
  );
}
