-- Plantilla para insertar un SEGUNDO medio.
-- Copia, adapta los valores y ejecuta en Supabase → SQL Editor.

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
) VALUES (
  'Nombre del segundo medio',
  'slug-del-medio',
  'emerald',
  'Pega aquí el prompt_personalidad de este medio...',
  'https://tu-sitio-wordpress.com',
  'usuario_wp',
  'xxxx xxxx xxxx xxxx xxxx xxxx',
  'panel@tu-medio.es',
  'password-del-buzon',
  'pop3.servidor-correo.net',
  110,
  false,
  '[
    {"slug": "negocio", "nombre": "Business & Strategy"},
    {"slug": "gastro", "nombre": "Gastro & Gourmet"},
    {"slug": "hotels", "nombre": "Hospitality & Hotels"},
    {"slug": "ibiza", "nombre": "Ibiza"}
  ]'::jsonb
);

-- Opcional: vincular el buzón actual de Travelicius al medio 1
-- UPDATE medios SET
--   email_pop_user = 'panel@travelicius.es',
--   email_pop_password = 'tu-password',
--   email_pop_host = 'pop3.servidor-correo.net',
--   email_pop_port = 110,
--   email_pop_secure = false
-- WHERE id = 1;
