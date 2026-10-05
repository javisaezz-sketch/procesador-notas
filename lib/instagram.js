import { createSupabaseClient } from './supabase';
import { createSupabaseAdmin } from './ingestNota.js';
import {
  esUrlStorageProyecto,
  firmarUrlImagenStorage,
} from './urlsImagenStorage.js';

export const HASHTAGS_OFICIALES_LAGLAM = [
  '#LaGlamDelBuenVivir',
  '#ElArteDelBuenVivir',
  '#VozConEstilo',
  '#ModaYTendencias',
  '#GastroLover',
  '#RutasConEstilo',
  '#ChicAndCasual',
  '#LifestyleElegante',
  '#PlanesConEncanto',
  '#EstiloDeVida',
];

export function htmlACaptionInstagram(html, titulo = '') {
  let texto = html || titulo || '';

  // Convertir saltos de bloque HTML a saltos de línea limpios
  texto = texto.replace(/<br\s*\/?>/gi, '\n');
  texto = texto.replace(/<\/p>/gi, '\n\n');
  texto = texto.replace(/<\/div>/gi, '\n');
  texto = texto.replace(/<\/h[1-6]>/gi, '\n\n');
  texto = texto.replace(/<\/li>/gi, '\n');

  // Eliminar el resto de etiquetas HTML
  texto = texto.replace(/<[^>]+>/g, '');

  // Decodificar entidades HTML comunes
  texto = texto
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // Normalizar saltos de línea (máximo 2 consecutivos)
  texto = texto.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Asegurar que los hashtags oficiales estén presentes al final
  const bloqueHashtags = HASHTAGS_OFICIALES_LAGLAM.join(' ');
  const faltanHashtags = !HASHTAGS_OFICIALES_LAGLAM.some((tag) =>
    texto.includes(tag),
  );

  if (faltanHashtags) {
    texto = `${texto}\n\n.\n.\n${bloqueHashtags}`;
  }

  return texto;
}

export function obtenerCredencialesInstagram(medio) {
  const token =
    process.env.INSTAGRAM_ACCESS_TOKEN?.trim() ||
    medio?.api_password?.trim() ||
    null;

  const accountId =
    process.env.INSTAGRAM_ACCOUNT_ID?.trim() ||
    '27928911076786809';

  const username =
    process.env.INSTAGRAM_USERNAME?.trim() ||
    medio?.api_user?.trim() ||
    'laglamdelbuenvivir';

  if (!token) {
    throw new Error(
      'Falta el token de Instagram (INSTAGRAM_ACCESS_TOKEN en .env o en el medio LaGlam).',
    );
  }

  return { token, accountId, username };
}

const MAX_FOTOS_CARRUSEL = 10;

export function parsearNicksInstagram(texto) {
  const vistos = new Set();
  const nicks = [];
  const avisos = [];
  const sobrantes = [];

  for (const parte of String(texto || '').split(/[,;\n]+/)) {
    const nick = parte.trim().replace(/^@+/, '').replace(/\s+/g, '');
    if (!nick) continue;
    if (!/^[A-Za-z0-9._]{1,30}$/.test(nick)) {
      avisos.push(`«${parte.trim()}» no es un nick de Instagram y no se ha etiquetado.`);
      continue;
    }
    const clave = nick.toLowerCase();
    if (clave === 'laglamdelbuenvivir' || vistos.has(clave)) continue;
    vistos.add(clave);
    if (nicks.length >= 20) {
      sobrantes.push(nick);
      continue;
    }
    nicks.push(nick);
  }

  if (sobrantes.length) {
    avisos.push(
      `Instagram permite 20 etiquetas. No se han etiquetado: ${sobrantes.map((nick) => `@${nick}`).join(', ')}.`,
    );
  }

  return { nicks, avisos };
}

function etiquetasEnFoto(nicks) {
  return nicks.map((username, index) => ({
    username,
    x: Number(((index + 1) / (nicks.length + 1)).toFixed(4)),
    y: 0.55,
  }));
}

async function resolverImagenesParaInstagram(articulo, supabase) {
  const urls = [];
  const add = (url) => {
    if (url && !urls.includes(url)) urls.push(url);
  };

  add(articulo.imagen_destacada_url);

  if (Array.isArray(articulo.imagenes_publicar_urls)) {
    for (const url of articulo.imagenes_publicar_urls) add(url);
  }

  if (urls.length === 0 && articulo.nota_prensa_id) {
    const { data: imgs } = await supabase
      .from('notas_prensa_imagenes')
      .select('url')
      .eq('nota_prensa_id', articulo.nota_prensa_id)
      .limit(MAX_FOTOS_CARRUSEL);

    for (const img of imgs || []) add(img.url);
  }

  return urls.slice(0, MAX_FOTOS_CARRUSEL);
}

async function prepararUrlPublica(imageUrl, supabaseAdmin) {
  if (!imageUrl) return null;

  if (esUrlStorageProyecto(imageUrl)) {
    // Generar URL firmada de 4 horas para que el crawler de Instagram pueda descargarla
    return firmarUrlImagenStorage(supabaseAdmin, imageUrl, 14400);
  }

  return imageUrl;
}

async function esperarContenedorListo(containerId, token, maxSegundos = 15) {
  const url = `https://graph.instagram.com/v22.0/${containerId}?fields=status_code&access_token=${token}`;

  for (let i = 0; i < maxSegundos; i++) {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    const status = data.status_code;

    if (status === 'FINISHED') {
      return true;
    }

    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(
        `Instagram rechazó procesar la imagen (estado: ${status}). Asegúrate de que la foto tiene formato válido (JPEG/PNG).`,
      );
    }

    // Esperar 1 segundo antes de reconsultar
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return true;
}

async function crearContenedorMedia(accountId, token, payload) {
  const createUrl = `https://graph.instagram.com/v22.0/${accountId}/media`;
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      ...(payload.user_tags ? { user_tags: JSON.stringify(payload.user_tags) } : {}),
      access_token: token,
    }),
    cache: 'no-store',
  });

  const createData = await createRes.json().catch(() => ({}));

  if (!createRes.ok || !createData?.id) {
    const errMessage =
      createData?.error?.message ||
      createData?.error?.error_user_msg ||
      `Error HTTP ${createRes.status} al crear contenedor en Instagram`;
    if (payload.user_tags) {
      const cuentas = payload.user_tags.map((tag) => `@${tag.username}`).join(', ');
      throw new Error(
        `No se pudo etiquetar ${cuentas}. Revisa que existan y permitan etiquetas. ${errMessage}`,
      );
    }
    throw new Error(`Error en Instagram: ${errMessage}`);
  }

  return createData.id;
}

async function crearContenedorConEtiquetas(accountId, token, payload, tags, segundos) {
  if (!tags?.length) {
    const id = await crearContenedorMedia(accountId, token, payload);
    await esperarContenedorListo(id, token, segundos);
    return { id, etiquetasOk: true };
  }

  try {
    const id = await crearContenedorMedia(accountId, token, {
      ...payload,
      user_tags: tags,
    });
    await esperarContenedorListo(id, token, segundos);
    return { id, etiquetasOk: true };
  } catch (errorTags) {
    console.warn('[instagram] Etiquetas rechazadas, se publica sin ellas:', errorTags.message);
    const id = await crearContenedorMedia(accountId, token, payload);
    await esperarContenedorListo(id, token, segundos);
    return { id, etiquetasOk: false, error: errorTags };
  }
}

export async function publicarEnInstagram(articulo, medio, options = {}) {
  const supabase = options.supabase ?? createSupabaseClient();
  const supabaseAdmin = createSupabaseAdmin();
  const { token, accountId, username } = obtenerCredencialesInstagram(medio);

  const rawImageUrls = await resolverImagenesParaInstagram(articulo, supabase);

  if (rawImageUrls.length === 0) {
    throw new Error(
      'Instagram requiere una imagen para publicar en el feed. Añade o selecciona una imagen destacada en el modal de revisión antes de publicar.',
    );
  }

  const publicImageUrls = [];
  for (const rawUrl of rawImageUrls) {
    const publicUrl = await prepararUrlPublica(rawUrl, supabaseAdmin);
    if (publicUrl) publicImageUrls.push(publicUrl);
  }

  if (publicImageUrls.length === 0) {
    throw new Error('No se pudo preparar ninguna foto pública para Instagram.');
  }

  const caption = htmlACaptionInstagram(
    articulo.contenido_generado,
    articulo.titulo_generado,
  );
  const { nicks, avisos } = parsearNicksInstagram(
    options.etiquetasInstagram || articulo.etiquetas_instagram,
  );
  const userTags = nicks.length ? etiquetasEnFoto(nicks) : null;
  let etiquetasRechazadas = null;

  let containerId;

  if (publicImageUrls.length === 1) {
    const creado = await crearContenedorConEtiquetas(
      accountId,
      token,
      { image_url: publicImageUrls[0], caption },
      userTags,
      20,
    );
    containerId = creado.id;
    if (!creado.etiquetasOk) etiquetasRechazadas = creado.error;
  } else {
    const childIds = [];
    for (let i = 0; i < publicImageUrls.length; i += 1) {
      const creado = await crearContenedorConEtiquetas(
        accountId,
        token,
        {
          image_url: publicImageUrls[i],
          is_carousel_item: true,
        },
        i === 0 ? userTags : null,
        20,
      );
      if (i === 0 && !creado.etiquetasOk) etiquetasRechazadas = creado.error;
      childIds.push(creado.id);
    }

    containerId = await crearContenedorMedia(accountId, token, {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption,
    });
    await esperarContenedorListo(containerId, token, 25);
  }

  // 3. Publicar el contenedor en el feed
  const publishUrl = `https://graph.instagram.com/v22.0/${accountId}/media_publish`;
  const publishRes = await fetch(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: token,
    }),
    cache: 'no-store',
  });

  const publishData = await publishRes.json().catch(() => ({}));

  if (!publishRes.ok || !publishData?.id) {
    const errMessage =
      publishData?.error?.message ||
      publishData?.error?.error_user_msg ||
      `Error HTTP ${publishRes.status} al publicar en Instagram`;
    throw new Error(`Error al publicar en Instagram: ${errMessage}`);
  }

  const publishedMediaId = publishData.id;

  // 4. Obtener el permalink oficial del post publicado
  let permalink = `https://www.instagram.com/${username}/`;
  try {
    const infoUrl = `https://graph.instagram.com/v22.0/${publishedMediaId}?fields=id,permalink&access_token=${token}`;
    const infoRes = await fetch(infoUrl, { cache: 'no-store' });
    const infoData = await infoRes.json().catch(() => ({}));
    if (infoData?.permalink) {
      permalink = infoData.permalink;
    }
  } catch (infoError) {
    console.warn('[instagram] No se pudo obtener el permalink exacto:', infoError.message);
  }

  if (etiquetasRechazadas && nicks.length) {
    const cuentas = nicks.map((nick) => `@${nick}`).join(', ');
    avisos.push(
      `No se han podido etiquetar ${cuentas}. Revisa que existan y permitan etiquetas. El post está publicado igualmente.`,
    );
  }

  return {
    id: publishedMediaId,
    link: permalink,
    status: 'publish',
    categoria: { id: 'feed', nombre: 'Feed Instagram', slug: 'feed' },
    contenidoPublicado: caption,
    etiquetadas: etiquetasRechazadas ? [] : nicks,
    avisoEtiquetas: avisos.length ? avisos.join(' ') : null,
  };
}
