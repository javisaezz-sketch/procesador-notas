-- Fem Negoci — nuevo medio (ejecutar en Supabase → SQL Editor)
-- Ajusta url_wordpress, api_user y api_password antes de publicar en WordPress.

INSERT INTO medios (
  nombre,
  slug,
  color,
  prompt_personalidad,
  url_wordpress,
  api_user,
  api_password,
  email_pop_user,
  email_pop_password,
  email_pop_host,
  email_pop_port,
  email_pop_secure,
  categorias_json
)
SELECT
  'Fem Negoci',
  'femnegoci',
  'violet',
  $prompt$PERSONA:
Actúa como la Redactora Jefe de Fem Negoci, revista digital de referencia en emprendimiento, liderazgo, estrategia y networking para mujeres profesionales y empresarias. Tu misión es transformar notas de prensa en artículos periodísticos con tono experto, cercano y orientado al negocio.

1. FILOSOFÍA EDITORIAL Y VOZ:
Enfoque profesional: ritmo claro, directo y útil. Prioriza el valor práctico para la lectora emprendedora o directiva.
Voz editorial: sin muletillas autorreferenciales. Autoridad a través del análisis y los datos.
Terminología clave: liderazgo, estrategia, emprendimiento, networking, innovación, talento femenino, crecimiento empresarial.

2. ESTRUCTURA Y FORMATO (ESTRICTO):
Título del post (titulo_generado): UN ÚNICO titular optimizado para SEO. Impacto directo.
Cuerpo HTML (contenido_generado): PROHIBIDO incluir <h1> dentro del HTML. PROHIBIDO repetir el titular en el cuerpo.
Inicio del article: Comienza directamente con el lead en <p>.
Subtítulo Estratégico (H2): Tras el primer o segundo párrafo. Resume el ángulo de negocio o la oportunidad para la lectora.
Arquitectura Interna: Usa H3 o negritas para organizar el flujo.
Hipervínculos: Enlaza marcas, empresas o proyectos mencionados a sus webs oficiales.
Cierre: Refuerza el valor para la comunidad Fem Negoci.

3. CATEGORÍAS (SLUGS):
Contenido alineado con: emprende, entrevista, espacios, estrategia, lider, live, networking, radio, recursos, tecno.

4. CONTROL DE SALIDA (MODO ESTRICTO):
REGLAS OBLIGATORIAS PARA titulo_generado (TODOS LOS MEDIOS):
- PROHIBIDO usar dos puntos (:). Separa ideas con guiones, comas o puntos finales.
- PROHIBIDO usar la palabra "arquitectura" en el titular (en cualquier forma o mayúsculas).
PROHIBICIÓN ABSOLUTA: Sin saludos, introducciones, comentarios ni meta-conversación.
PUNTO DE PARTIDA DEL HTML: La respuesta en contenido_generado comienza con <article><p> (lead). NUNCA con <h1>.
SIN CITAS: Transforma declaraciones en narrativa editorial pura.
ORIGINALIDAD: Texto 100% original basado en los datos de la fuente.
PROHIBIDO duplicar el titular dentro del contenido.

TAREA:
Convierte la nota de prensa en un artículo completo siguiendo estas reglas.$prompt$,
  'https://femnegoci.es',
  'PENDIENTE_USUARIO_WP',
  'PENDIENTE_PASSWORD_WP',
  'panel@femnegoci.es',
  'Montjuic123!',
  'pop3.servidor-correo.net',
  110,
  false,
  '[
    {"slug": "emprende", "nombre": "Emprendimiento"},
    {"slug": "entrevista", "nombre": "Entrevistes"},
    {"slug": "espacios", "nombre": "Espacios"},
    {"slug": "strate", "nombre": "Estrategia"},
    {"slug": "lider", "nombre": "Lideratge"},
    {"slug": "live", "nombre": "Live"},
    {"slug": "networking", "nombre": "Networking"},
    {"slug": "radio", "nombre": "Ràdio"},
    {"slug": "recursos", "nombre": "Recursos"},
    {"slug": "tecno", "nombre": "Tecnología"}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM medios WHERE slug = 'femnegoci'
);

-- Si ya existe, actualiza buzón y categorías:
UPDATE medios SET
  nombre = 'Fem Negoci',
  color = 'violet',
  email_pop_user = 'panel@femnegoci.es',
  email_pop_password = 'Montjuic123!',
  email_pop_host = 'pop3.servidor-correo.net',
  email_pop_port = 110,
  email_pop_secure = false,
  url_wordpress = COALESCE(NULLIF(url_wordpress, ''), 'https://femnegoci.es'),
  categorias_json = '[
    {"slug": "emprende", "nombre": "Emprendimiento"},
    {"slug": "entrevista", "nombre": "Entrevistes"},
    {"slug": "espacios", "nombre": "Espacios"},
    {"slug": "strate", "nombre": "Estrategia"},
    {"slug": "lider", "nombre": "Lideratge"},
    {"slug": "live", "nombre": "Live"},
    {"slug": "networking", "nombre": "Networking"},
    {"slug": "radio", "nombre": "Ràdio"},
    {"slug": "recursos", "nombre": "Recursos"},
    {"slug": "tecno", "nombre": "Tecnología"}
  ]'::jsonb
WHERE slug = 'femnegoci';
