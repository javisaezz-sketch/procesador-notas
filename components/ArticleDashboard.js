'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import ContentModal from './ContentModal';
import PublishModal from './PublishModal';
import ReenviarMedioModal from './ReenviarMedioModal';
import ApprovedArticleCard from './ApprovedArticleCard';
import ErrorNotaCard from './ErrorNotaCard';
import GoogleMapsCard from './GoogleMapsCard';
import MedioLogo, { MedioBadge } from './MedioLogo';
import { agruparPorMedio, esMedioInstagram, getMedioTheme, ordenarMedios } from '@/lib/medios';
import { extraerFechaEvento } from '@/lib/fechaEvento';

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

function ArticleCard({
  articulo,
  isPublishing,
  isAnulando,
  isReenviando,
  onView,
  onPublish,
  onReenviarMedio,
  onCancel,
  onCancelarPrograma,
}) {
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

      {(articulo.imagen_destacada_url || articulo.imagenes_adicionales > 0) && (
        <p className="mt-3 text-sm text-slate-500">
          {articulo.imagen_destacada_url ? 'Con imagen destacada' : 'Sin destacada'}
          {articulo.imagenes_adicionales > 0
            ? ` · ${articulo.imagenes_adicionales + (articulo.imagen_destacada_url ? 1 : 0)} foto(s) en la nota`
            : ''}
        </p>
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
        {(() => {
          const acto =
            articulo.fecha_evento ||
            extraerFechaEvento(
              `${articulo.titulo_generado || ''} ${articulo.notas_prensa?.asunto || ''}`,
            );
          if (!acto) return null;
          return (
            <p>
              <span className="font-medium text-slate-800">Acto:</span>{' '}
              {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
                new Date(`${acto}T12:00:00`),
              )}
            </p>
          );
        })()}
        {articulo.estado === 'programado' && articulo.fecha_programada && (
          <p className="font-medium text-amber-800">
            Programado: {formatFecha(articulo.fecha_programada)}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onView}
            disabled={isPublishing || isAnulando || isReenviando}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:py-2.5 sm:text-sm"
          >
            Ver contenido
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={isPublishing || isAnulando || isReenviando}
            className={`flex-1 rounded-xl px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50 sm:py-2.5 sm:text-sm ${
              esMedioInstagram(articulo.medios)
                ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 hover:opacity-90'
                : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400'
            }`}
          >
            {isPublishing
              ? 'Publicando...'
              : esMedioInstagram(articulo.medios)
                ? 'Publicar en Instagram'
                : 'Aprobar'}
          </button>
        </div>
        <button
          type="button"
          onClick={onReenviarMedio}
          disabled={isPublishing || isAnulando || isReenviando}
          className="rounded-xl border border-violet-200 px-4 py-3.5 text-base font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50 sm:py-2.5 sm:text-sm"
        >
          {isReenviando ? 'Encolando...' : 'Procesar en otro medio'}
        </button>
        {articulo.estado === 'programado' && (
          <button
            type="button"
            onClick={onCancelarPrograma}
            disabled={isPublishing || isAnulando || isReenviando}
            className="rounded-xl border border-amber-200 px-4 py-3.5 text-base font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50 sm:py-2.5 sm:text-sm"
          >
            Quitar programación
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={isPublishing || isAnulando || isReenviando}
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
  notasEnCola = 0,
  medios = [],
  googleMapsReviews = [],
}) {
  const router = useRouter();
  const [vistaPanel, setVistaPanel] = useState('pendientes');
  const [items, setItems] = useState(articulos);
  const [approvedItems, setApprovedItems] = useState(articulosAprobados);
  const [errorItems, setErrorItems] = useState(notasConError);
  const [gmapsItems, setGmapsItems] = useState(googleMapsReviews);
  const [gmapsCargadas, setGmapsCargadas] = useState(googleMapsReviews.length > 0);
  const [cargandoGmaps, setCargandoGmaps] = useState(false);
  const [filtroMedio, setFiltroMedio] = useState('todos');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [publishArticle, setPublishArticle] = useState(null);
  const [reenviarArticulo, setReenviarArticulo] = useState(null);
  const [reenviandoId, setReenviandoId] = useState(null);
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
  const [generandoReviewId, setGenerandoReviewId] = useState(null);
  const [descartandoReviewId, setDescartandoReviewId] = useState(null);
  const [sincronizandoMaps, setSincronizandoMaps] = useState(false);
  const [busquedaMaps, setBusquedaMaps] = useState('');
  const [ciudadFiltroMaps, setCiudadFiltroMaps] = useState('todas');
  const [feedback, setFeedback] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [pipelineEnMarcha, setPipelineEnMarcha] = useState(false);
  const [selectedApprovedIds, setSelectedApprovedIds] = useState([]);
  const [publicandoLote, setPublicandoLote] = useState(false);
  const [revisionListaPublicar, setRevisionListaPublicar] = useState(false);

  useEffect(() => {
    setItems(articulos);
  }, [articulos]);

  useEffect(() => {
    if (googleMapsReviews.length > 0) {
      setGmapsItems(googleMapsReviews);
      setGmapsCargadas(true);
    }
  }, [googleMapsReviews]);

  async function cargarGoogleMaps(forzar = false) {
    if (cargandoGmaps) return;
    if (gmapsCargadas && !forzar) return;

    setCargandoGmaps(true);
    try {
      const res = await fetch('/api/google-maps/reviews', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudieron cargar las reseñas');
      }
      setGmapsItems(data.reviews || []);
      setGmapsCargadas(true);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Error al cargar Google Maps: ${err.message}`,
      });
    } finally {
      setCargandoGmaps(false);
    }
  }

  useEffect(() => {
    setApprovedItems(articulosAprobados);
    setSelectedApprovedIds((prev) =>
      prev.filter((id) =>
        articulosAprobados.some(
          (articulo) =>
            articulo.id === id &&
            articulo.wp_post_status !== 'publish' &&
            articulo.wp_post_id,
        ),
      ),
    );
  }, [articulosAprobados]);

  useEffect(() => {
    setErrorItems(notasConError);
  }, [notasConError]);

  function handleRefrescarPanel() {
    if (refrescando) return;
    setRefrescando(true);
    setUltimaActualizacion(new Date());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('panel-refresh'));
    }
    if (vistaPanel === 'gmaps') {
      cargarGoogleMaps(true);
    }
    router.refresh();
    window.setTimeout(() => setRefrescando(false), 800);
  }

  async function handlePonerEnMarcha() {
    if (pipelineEnMarcha || refrescando) return;

    setPipelineEnMarcha(true);
    setFeedback({
      type: 'info',
      message: 'Pipeline en marcha: lee el correo y genera las notas de cuatro en cuatro.',
    });

    try {
      let pasada = 0;
      let generados = 0;
      let nuevas = 0;
      let quedan = true;
      let avisos = 0;
      let cortes = 0;
      const maxPasadas = 6;

      while (quedan && pasada < maxPasadas && cortes < 4) {
        if (pasada > 0) {
          setFeedback({
            type: 'info',
            message: `Van ${generados} artículos. Las que faltan siguen en la cola y se generan ahora.`,
          });
        }

        const response = await fetch('/api/pipeline/ejecutar', { method: 'POST' });
        const raw = await response.text();
        let data = {};

        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { error: raw };
        }

        const bruto = `${data.error || ''} ${data.message || ''} ${raw || ''}`;
        const cortado = response.status === 409
          || /tiempo|timeout|504|FUNCTION_INVOCATION|An error occurred/i.test(bruto);

        if (cortado) {
          cortes += 1;
          setFeedback({
            type: 'info',
            message: 'Sigue en marcha. Lo ya leído no se pierde: espera un momento y continúo con la cola.',
          });
          await new Promise((resolve) => window.setTimeout(resolve, 12000));
          continue;
        }

        if (!response.ok || !data.ok) {
          throw new Error(data.error || data.message || 'No se pudo poner en marcha el pipeline');
        }

        cortes = 0;
        pasada += 1;
        generados += data.resumen?.articulosGenerados ?? 0;
        nuevas += data.resumen?.emailsNuevas ?? 0;
        avisos += data.resumen?.advertencias ?? 0;
        quedan = Boolean(data.resumen?.quedanNotas);
        router.refresh();
      }

      const message = `Pipeline listo. ${nuevas} email${nuevas === 1 ? '' : 's'} nuevo${nuevas === 1 ? '' : 's'}, ${generados} artículo${generados === 1 ? '' : 's'} generado${generados === 1 ? '' : 's'}.${avisos ? ' Hay avisos: ábrelos en Errores IA.' : ''}${quedan ? ' Quedan notas en la cola: no se han perdido. Vuelve a pulsar Poner en marcha.' : ''}`;
      setFeedback({ type: 'success', message });
      setUltimaActualizacion(new Date());
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('panel-refresh'));
      }
      if (vistaPanel === 'gmaps') {
        cargarGoogleMaps(true);
      }
      router.refresh();
    } catch (error) {
      const cortado = error.message === 'timeout';
      setFeedback({
        type: 'error',
        message: cortado
          ? 'El pipeline se ha cortado por tiempo. Pulsa Actualizar: parte del trabajo puede haber quedado hecha.'
          : error.message,
      });
    } finally {
      setPipelineEnMarcha(false);
    }
  }

  const listaActiva =
    vistaPanel === 'pendientes'
      ? items
      : vistaPanel === 'aprobados'
        ? approvedItems
        : vistaPanel === 'errores'
          ? errorItems
          : gmapsItems;

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

  const ciudadesMapsDisponibles = useMemo(() => {
    const set = new Set();
    gmapsItems.forEach((r) => {
      if (r.city?.trim()) set.add(r.city.trim());
    });
    return Array.from(set).sort();
  }, [gmapsItems]);

  const reviewsMapsFiltradas = useMemo(() => {
    return gmapsItems.filter((r) => {
      if (ciudadFiltroMaps !== 'todas' && r.city !== ciudadFiltroMaps) {
        return false;
      }
      if (!busquedaMaps.trim()) return true;
      const q = busquedaMaps.toLowerCase().trim();
      const nombre = (r.place_name || '').toLowerCase();
      const ciudad = (r.city || '').toLowerCase();
      const texto = (r.texto_original || '').toLowerCase();
      return nombre.includes(q) || ciudad.includes(q) || texto.includes(q);
    });
  }, [gmapsItems, busquedaMaps, ciudadFiltroMaps]);

  function marcarRevisionModificada() {
    setRevisionListaPublicar(false);
  }

  function openContentModal(articulo) {
    setSelectedArticle(articulo);
    setRevisionListaPublicar(false);
    setEditedTitle(articulo.titulo_generado ?? '');
    setEditedContent('');
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

    Promise.all([
      fetch(`/api/articulos/${articulo.id}`).then((response) => response.json()),
      fetch(`/api/articulos/${articulo.id}/imagenes`).then((response) =>
        response.json(),
      ),
    ])
      .then(([detalle, imagenesData]) => {
        if (!detalle.ok) {
          throw new Error(detalle.error || 'No se pudo cargar el artículo');
        }
        if (!imagenesData.ok) {
          throw new Error(imagenesData.error || 'No se pudieron cargar las imágenes');
        }

        const actualizado = {
          ...articulo,
          ...detalle.articulo,
        };
        setSelectedArticle(actualizado);
        setEditedTitle(actualizado.titulo_generado ?? '');
        setEditedContent(actualizado.contenido_generado ?? '');
        setEditedEmail(actualizado.email_notificacion ?? articulo.email_notificacion ?? '');
        setImagenesNota(imagenesData.imagenes ?? []);
        setDestacadaUrl(imagenesData.imagen_destacada_url ?? null);
        setPublicarUrls(imagenesData.imagenes_publicar_urls ?? []);
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
    setRevisionListaPublicar(false);
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

    const destacadaAGuardar =
      destacadaUrl ??
      (publicarUrls.length ? publicarUrls[0] : null);

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
          imagen_destacada_url: destacadaAGuardar,
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

      if (typeof actualizado.contenido_generado === 'string') {
        setEditedContent(actualizado.contenido_generado);
      }

      setPublicarUrls(actualizado.imagenes_publicar_urls ?? publicarUrls);
      setDestacadaUrl(actualizado.imagen_destacada_url ?? destacadaUrl);

      setRevisionListaPublicar(true);

      setFeedback({
        type: 'success',
        message: `Cambios guardados. Ya puedes pulsar Publicar.`,
      });
      return null;
    } catch (error) {
      setSaveError(error.message);
      return error.message;
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

  async function handleCancelarPrograma(articulo) {
    setPublishingId(articulo.id);
    try {
      const response = await fetch(`/api/articulos/${articulo.id}/programar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelar: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo quitar la programación');
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === articulo.id
            ? { ...item, estado: 'pendiente_revision', fecha_programada: null }
            : item,
        ),
      );
      setFeedback({
        type: 'info',
        message: `"${articulo.titulo_generado}" vuelve a la cola, sin hora.`,
      });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setPublishingId(null);
    }
  }

  function avisoAgenciaTexto(aviso) {
    if (!aviso || aviso.omitido) return '';
    if (aviso.enviado) return ` Aviso enviado a ${aviso.email}.`;
    if (aviso.error) return ` El post está publicado, pero no se pudo avisar a la agencia: ${aviso.error}`;
    return '';
  }

  function avisoBorradorInstagram(data) {
    if (data?.borradorInstagram?.creado) {
      return ' También se ha creado un borrador de Instagram en Pendientes.';
    }
    return '';
  }

  async function handlePublicar(
    articulo,
    categoriaSlug,
    { publicarEnWeb = false, programarEn = null, notificar = null, emailNotificacion = null, etiquetasInstagram = '' } = {},
  ) {
    setPublishingId(articulo.id);
    setFeedback({
      type: 'info',
      message: programarEn
        ? `Programando "${articulo.titulo_generado}"...`
        : publicarEnWeb
          ? `Publicando "${articulo.titulo_generado}" en la web...`
          : `Enviando "${articulo.titulo_generado}" como borrador a ${getMedioNombre(articulo)}...`,
    });

    try {
      if (selectedArticle?.id === articulo.id) {
        const errorGuardado = await handleGuardar(articulo);
        if (errorGuardado) {
          throw new Error(errorGuardado);
        }
      }

      const response = await fetch(`/api/articulos/${articulo.id}/publicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoriaSlug,
          publicarEnWeb,
          programarEn,
          notificar,
          emailNotificacion,
          etiquetasInstagram,
        }),
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

      if (data.programado) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === articulo.id
              ? {
                  ...item,
                  estado: 'programado',
                  fecha_programada: data.fecha_programada,
                }
              : item,
          ),
        );
        setPublishArticle(null);
        setFeedback({
          type: 'success',
          message: `"${articulo.titulo_generado}" se publicará en la siguiente pasada del pipeline.${
            notificar && emailNotificacion
              ? ` Al publicarse se avisará a ${emailNotificacion}.`
              : ''
          }`,
        });
        router.refresh();
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== articulo.id));
      setPublishArticle(null);
      if (selectedArticle?.id === articulo.id) {
        closeContentModal();
      }

      if (publicarEnWeb) {
        setApprovedItems((prev) => prev.filter((item) => item.id !== articulo.id));
        const esIg =
          data.esInstagram ||
          data.medioSlug === 'laglam' ||
          data.medio === 'LaGlam' ||
          data.wordpressPostUrl?.includes('instagram.com');

        const avisoLaglam = avisoAgenciaTexto(data.avisoAgencia);
        setFeedback({
          type: 'success',
          message: esIg
            ? `Publicado con éxito en Instagram (@laglamdelbuenvivir). Ya está visible en el feed.${avisoLaglam}`
            : `Publicado en ${data.medio} → categoría "${data.categoria}". Ya está visible en la web.${data.emailNotificacion ? ` Notificación a ${data.emailNotificacion}.` : ''}${mensajeEmailBuzon(data.emailBuzon)}${avisoBorradorInstagram(data)}`,
          link: data.wordpressPostUrl,
          linkLabel: esIg ? 'Ver post en Instagram' : 'Ver artículo publicado',
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
          message: `Borrador creado en ${data.medio} → categoría "${data.categoria}". Puedes publicarlo en la web desde la pestaña Aprobados.${data.emailNotificacion ? ` Notificará a ${data.emailNotificacion} al publicar.` : ''}${mensajeEmailBuzon(data.emailBuzon)}${avisoBorradorInstagram(data)}`,
          link: data.wordpressPostUrl,
          linkLabel: 'Ver borrador en WordPress',
        });
      }

      router.refresh();
    } catch (error) {
      const crudo = String(error.message || '');
      const cortado =
        crudo.includes('<!DOCTYPE') ||
        crudo.length > 400 ||
        /timeout|504|FUNCTION_INVOCATION/i.test(crudo);
      setFeedback({
        type: 'error',
        message: cortado
          ? 'La publicación se ha cortado por tiempo. El post sigue en Pendientes: vuelve a pulsar Publicar.'
          : crudo || 'No se pudo publicar el artículo',
      });
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

  function toggleApprovedSelection(articuloId) {
    setSelectedApprovedIds((prev) =>
      prev.includes(articuloId)
        ? prev.filter((id) => id !== articuloId)
        : [...prev, articuloId],
    );
  }

  async function handlePublicarEnWebLote() {
    if (!selectedApprovedIds.length) return;

    const confirmar = window.confirm(
      `¿Publicar ${selectedApprovedIds.length} borrador${selectedApprovedIds.length === 1 ? '' : 'es'} en la web?`,
    );

    if (!confirmar) return;

    setPublicandoLote(true);
    setFeedback({
      type: 'info',
      message: `Publicando ${selectedApprovedIds.length} artículo(s) en la web...`,
    });

    try {
      const response = await fetch('/api/articulos/publicar-en-web-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedApprovedIds }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo publicar en lote');
      }

      const publicadosIds = (data.resultados ?? []).map((item) => item.id);
      setApprovedItems((prev) =>
        prev.filter((item) => !publicadosIds.includes(item.id)),
      );
      setSelectedApprovedIds((prev) =>
        prev.filter((id) => !publicadosIds.includes(id)),
      );

      if (data.fallidos > 0) {
        setFeedback({
          type: 'error',
          message: `Publicados ${data.publicados}, fallidos ${data.fallidos}. ${data.errores?.[0]?.error ?? ''}`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: `${data.publicados} artículo(s) publicados en la web.`,
        });
      }

      router.refresh();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setPublicandoLote(false);
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

  async function handleGenerarPostGoogleMaps({
    review,
    fotoSeleccionadaUrl,
    fotosSeleccionadas,
    instruccionesEditor,
    etiquetasInstagram,
  }) {
    setGenerandoReviewId(review.review_id);
    setFeedback(null);

    try {
      const res = await fetch(
        `/api/google-maps/${encodeURIComponent(review.review_id)}/generar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            review,
            fotoSeleccionadaUrl,
            fotosSeleccionadas,
            instruccionesEditor,
            etiquetasInstagram,
          }),
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.publicado) {
        throw new Error(
          data.error ||
            data.errorPublicacion ||
            'No se pudo publicar el post en Instagram',
        );
      }

      setGmapsItems((prev) =>
        prev.filter((r) => r.review_id !== review.review_id),
      );
      setGenerandoReviewId(null);
      setFeedback({
        type: 'success',
        message: data.message || `Publicado en Instagram (@laglamdelbuenvivir): "${review.place_name}".`,
        link: data.instagramUrl,
        linkLabel: data.instagramUrl ? 'Ver post en Instagram' : undefined,
      });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Error al generar el post: ${err.message}`,
      });
      setGenerandoReviewId(null);
    }
  }

  async function handleDescartarGoogleMaps(review) {
    const confirmacion = window.confirm(
      `¿Descartar la reseña de "${review.place_name}"?\n\nNo volverá a aparecer en la pestaña de Google Maps.`,
    );
    if (!confirmacion) return;

    setDescartandoReviewId(review.review_id);
    setFeedback(null);

    try {
      const res = await fetch(
        `/api/google-maps/${encodeURIComponent(review.review_id)}/descartar`,
        {
          method: 'POST',
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo descartar la reseña');
      }

      setGmapsItems((prev) =>
        prev.filter((r) => r.review_id !== review.review_id),
      );
      setDescartandoReviewId(null);
      setFeedback({
        type: 'info',
        message: `Reseña de "${review.place_name}" descartada.`,
      });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Error al descartar reseña: ${err.message}`,
      });
      setDescartandoReviewId(null);
    }
  }

  async function handleSincronizarGoogleMaps() {
    setSincronizandoMaps(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/google-maps/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo sincronizar');
      }

      setGmapsItems(data.reviews || []);
      setGmapsCargadas(true);
      setFeedback({
        type: 'success',
        message:
          data.message ||
          `Sincronización completada. ${data.count} reseña(s) pendiente(s).`,
      });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Error al sincronizar con Google Maps: ${err.message}`,
      });
    } finally {
      setSincronizandoMaps(false);
    }
  }

  async function handleReenviarMedio(articulo, medioId) {
    setReenviandoId(articulo.id);
    setFeedback({
      type: 'info',
      message: `Encolando nota para otro medio...`,
    });

    try {
      const response = await fetch(`/api/articulos/${articulo.id}/reenviar-medio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medioId }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo encolar la nota');
      }

      setReenviarArticulo(null);
      setFeedback({
        type: 'success',
        message:
          data.message ||
          'Nota encolada. El pipeline generará el artículo en los próximos minutos.',
      });
      router.refresh();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setReenviandoId(null);
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
            isPublishing={
              publishingWebId === articulo.id ||
              publicandoLote ||
              reenviandoId === articulo.id
            }
            isAnulando={anulandoId === articulo.id}
            selected={selectedApprovedIds.includes(articulo.id)}
            onToggleSelect={() => toggleApprovedSelection(articulo.id)}
            onPublishWeb={() => handlePublicarEnWeb(articulo)}
            onReenviarMedio={() => setReenviarArticulo(articulo)}
            isReenviando={reenviandoId === articulo.id}
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
          const isReenviando = reenviandoId === articulo.id;

          return (
            <ArticleCard
              key={articulo.id}
              articulo={articulo}
              isPublishing={isPublishing}
              isAnulando={isAnulando}
              isReenviando={isReenviando}
              onView={() => openContentModal(articulo)}
              onPublish={() => setPublishArticle(articulo)}
              onReenviarMedio={() => setReenviarArticulo(articulo)}
              onCancel={() => handleAnular(articulo)}
              onCancelarPrograma={() => handleCancelarPrograma(articulo)}
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
        <button
          type="button"
          onClick={() => {
            setVistaPanel('gmaps');
            setFiltroMedio('todos');
            cargarGoogleMaps();
          }}
          className={`inline-flex items-center gap-2 shrink-0 rounded-full px-5 py-3 text-sm font-semibold transition sm:py-2.5 ${
            vistaPanel === 'gmaps'
              ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-sm'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <svg className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
          </svg>
          <span>
            Google Maps
            {gmapsCargadas ? ` (${gmapsItems.length})` : ''}
          </span>
        </button>
      </div>

      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600 sm:text-sm">
            {vistaPanel === 'gmaps' ? 'Local Guide & Gastro' : 'Panel editorial'}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-3xl">
            {vistaPanel === 'pendientes'
              ? 'Artículos pendientes de revisión'
              : vistaPanel === 'aprobados'
                ? 'Borradores aprobados en WordPress'
                : vistaPanel === 'errores'
                  ? 'Notas con error de procesamiento'
                  : 'Reseñas de Google Maps'}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600 sm:text-base">
            {vistaPanel === 'pendientes'
              ? 'Revisa el contenido, elige categoría y publícalo en la web o déjalo en borrador.'
              : vistaPanel === 'aprobados'
                ? 'Publica en la web los borradores ya aprobados, sin entrar en WordPress.'
                : vistaPanel === 'errores'
                  ? 'Reintenta las notas que fallaron al generarse con Gemini o descártalas.'
                  : 'Elige fotos y publícalo directo en @laglamdelbuenvivir. No pasa por la cola de LaGlam: si Instagram falla, la reseña se queda aquí para reintentarlo.'}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {vistaPanel === 'gmaps' && (
            <button
              type="button"
              disabled={sincronizandoMaps}
              onClick={handleSincronizarGoogleMaps}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <svg
                className={`h-4 w-4 text-slate-500 ${sincronizandoMaps ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{sincronizandoMaps ? 'Sincronizando...' : 'Sincronizar con Maps'}</span>
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex w-fit shrink-0 items-center rounded-full bg-indigo-50 px-5 py-2.5 text-base font-medium text-indigo-700 ring-1 ring-indigo-100 sm:px-4 sm:py-2 sm:text-sm">
              {vistaPanel === 'pendientes' ? (
                <>
                  {items.length} pendiente{items.length === 1 ? '' : 's'}
                  {notasEnCola > 0
                    ? ` · ${notasEnCola} en cola`
                    : ''}
                </>
              ) : vistaPanel === 'aprobados' ? (
                <>
                  {borradoresPendientesWeb} borrador
                  {borradoresPendientesWeb === 1 ? '' : 'es'} por publicar
                </>
              ) : vistaPanel === 'errores' ? (
                <>
                  {errorItems.length} error{errorItems.length === 1 ? '' : 'es'}
                </>
              ) : (
                <>
                  {gmapsItems.length} reseña{gmapsItems.length === 1 ? '' : 's'}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleRefrescarPanel}
              disabled={refrescando}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              title="Actualizar el panel ahora"
            >
              <svg
                className={`h-4 w-4 text-slate-500 ${refrescando ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{refrescando ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
            <button
              type="button"
              onClick={handlePonerEnMarcha}
              disabled={pipelineEnMarcha || refrescando}
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
              title="Leer el correo y generar las notas pendientes ahora"
            >
              <svg
                className={`h-4 w-4 ${pipelineEnMarcha ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{pipelineEnMarcha ? 'En marcha...' : 'Poner en marcha'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 sm:text-right">
            Sin auto-refresh. Pulsa Actualizar cuando quieras recargar.
            {ultimaActualizacion
              ? ` Última: ${ultimaActualizacion.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : ''}
          </p>
        </div>
      </section>

      {vistaPanel === 'aprobados' && selectedApprovedIds.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-green-900">
            {selectedApprovedIds.length} borrador
            {selectedApprovedIds.length === 1 ? '' : 'es'} seleccionado
            {selectedApprovedIds.length === 1 ? '' : 's'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setSelectedApprovedIds([])}
              disabled={publicandoLote}
              className="rounded-xl border border-green-300 px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-100 disabled:opacity-50"
            >
              Limpiar selección
            </button>
            <button
              type="button"
              onClick={handlePublicarEnWebLote}
              disabled={publicandoLote}
              className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-green-400"
            >
              {publicandoLote
                ? 'Publicando...'
                : `Publicar ${selectedApprovedIds.length} en la web`}
            </button>
          </div>
        </div>
      )}

      {vistaPanel !== 'gmaps' && mediosDisponibles.length > 1 && (
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

      {vistaPanel === 'gmaps' ? (
        cargandoGmaps && !gmapsCargadas ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="text-lg font-semibold text-slate-900">Cargando reseñas de Google Maps...</p>
            <p className="mt-2 text-sm text-slate-500">Solo se consulta al abrir esta pestaña, para no gastar egress.</p>
          </div>
        ) : gmapsItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pink-50 text-pink-600 mb-3">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-slate-900 sm:text-lg">
              No hay reseñas pendientes de Google Maps
            </p>
            <p className="mt-2 text-base text-slate-500 sm:text-sm max-w-md mx-auto">
              Todas las reseñas han sido publicadas o descartadas. Puedes sincronizar para comprobar si hay nuevas reseñas en tu perfil de Local Guide.
            </p>
            <button
              type="button"
              disabled={sincronizandoMaps}
              onClick={handleSincronizarGoogleMaps}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {sincronizandoMaps ? 'Sincronizando...' : 'Sincronizar con Maps ahora'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Barra de búsqueda y filtro por ciudad */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={busquedaMaps}
                  onChange={(e) => setBusquedaMaps(e.target.value)}
                  placeholder="Buscar restaurante, local o ciudad..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-pink-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
                {busquedaMaps && (
                  <button
                    type="button"
                    onClick={() => setBusquedaMaps('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {ciudadesMapsDisponibles.length > 1 && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-slate-500">Ciudad:</span>
                  <select
                    value={ciudadFiltroMaps}
                    onChange={(e) => setCiudadFiltroMaps(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-pink-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                  >
                    <option value="todas">Todas las ubicaciones ({gmapsItems.length})</option>
                    {ciudadesMapsDisponibles.map((ciudad) => {
                      const count = gmapsItems.filter((r) => r.city === ciudad).length;
                      return (
                        <option key={ciudad} value={ciudad}>
                          {ciudad} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* Contador de reseñas activas */}
            <div className="flex items-center justify-between px-1 text-xs text-slate-500">
              <span className="font-medium">
                Mostrando <strong className="text-slate-800">{reviewsMapsFiltradas.length}</strong> de {gmapsItems.length} reseñas gastronómicas (todas de ★★★★★ 5 estrellas)
              </span>
              {(busquedaMaps || ciudadFiltroMaps !== 'todas') && (
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaMaps('');
                    setCiudadFiltroMaps('todas');
                  }}
                  className="font-semibold text-pink-600 hover:text-pink-800"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {reviewsMapsFiltradas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <p className="text-base font-medium text-slate-700">
                  No se encontraron reseñas con los filtros actuales.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaMaps('');
                    setCiudadFiltroMaps('todas');
                  }}
                  className="mt-3 text-xs font-semibold text-pink-600 hover:text-pink-800"
                >
                  Ver todas las {gmapsItems.length} reseñas
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {reviewsMapsFiltradas.map((review) => (
                  <GoogleMapsCard
                    key={review.review_id}
                    review={review}
                    isGenerando={generandoReviewId === review.review_id}
                    isDescartando={descartandoReviewId === review.review_id}
                    onGenerar={handleGenerarPostGoogleMaps}
                    onDescartar={handleDescartarGoogleMaps}
                  />
                ))}
              </div>
            )}
          </div>
        )
      ) : itemsFiltrados.length === 0 ? (
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
          onTitleChange={(value) => {
            marcarRevisionModificada();
            setEditedTitle(value);
          }}
          onContentChange={(value) => {
            marcarRevisionModificada();
            setEditedContent(value);
          }}
          onEmailNotificacionChange={(value) => {
            marcarRevisionModificada();
            setEditedEmail(value);
          }}
          onDestacadaChange={(value) => {
            marcarRevisionModificada();
            setDestacadaUrl(value);
          }}
          onPublicarChange={(value) => {
            marcarRevisionModificada();
            setPublicarUrls(value);
          }}
          onClose={closeContentModal}
          onSave={() => handleGuardar(selectedArticle)}
          onPublish={() => setPublishArticle(selectedArticle)}
          canPublish={revisionListaPublicar}
          isPublishing={publishingId === selectedArticle.id}
          isSaving={guardandoId === selectedArticle.id}
          saveError={saveError}
        />
      )}

      {vistaPanel === 'pendientes' && publishArticle && (
        <PublishModal
          articulo={publishArticle}
          isPublishing={publishingId === publishArticle.id}
          error={feedback?.type === 'error' ? feedback.message : ''}
          onClose={() => setPublishArticle(null)}
          onConfirm={(categoriaSlug, opciones) =>
            handlePublicar(publishArticle, categoriaSlug, opciones)
          }
        />
      )}

      {reenviarArticulo && (
        <ReenviarMedioModal
          articulo={reenviarArticulo}
          medios={medios}
          isSubmitting={reenviandoId === reenviarArticulo.id}
          onClose={() => setReenviarArticulo(null)}
          onConfirm={(medioId) => handleReenviarMedio(reenviarArticulo, medioId)}
        />
      )}
    </>
  );
}
