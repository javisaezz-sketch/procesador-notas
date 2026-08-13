-- 1) Ejecuta PRIMERO supabase-medios.sql (si aún no lo hiciste)
-- 2) Luego ejecuta ESTE archivo en Supabase → SQL Editor → Run

UPDATE medios SET
  slug = 'travelicius',
  color = 'indigo',
  email_pop_user = 'panel@travelicius.es',
  email_pop_password = 'Montjuic123!',
  email_pop_host = 'pop3.servidor-correo.net',
  email_pop_port = 110,
  email_pop_secure = false
WHERE id = 1;

UPDATE medios SET
  slug = 'vidaystyle',
  color = 'emerald',
  email_pop_user = 'panel@vidaystyle.com',
  email_pop_password = 'Montjuic123!',
  email_pop_host = 'pop3.servidor-correo.net',
  email_pop_port = 110,
  email_pop_secure = false
WHERE id = 4;
