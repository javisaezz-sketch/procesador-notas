-- Glam Closet (medio id: 5) — ejecutar si prefieres SQL manual

UPDATE medios SET
  slug = 'glamcloset',
  color = 'rose',
  email_pop_user = 'panel@glamcloset.cat',
  email_pop_password = 'Montjuic123!',
  email_pop_host = 'pop3.servidor-correo.net',
  email_pop_port = 110,
  email_pop_secure = false,
  categorias_json = '[
    {"slug": "iconic-style", "nombre": "Iconic Style"},
    {"slug": "glam", "nombre": "La Glam"},
    {"slug": "radio", "nombre": "Radio"},
    {"slug": "skincare-beauty", "nombre": "Skincare & Beauty"},
    {"slug": "smart-shopping", "nombre": "Smart Shopping"},
    {"slug": "styling-guide", "nombre": "Styling Guide"},
    {"slug": "trend-report", "nombre": "Trend Report"}
  ]'::jsonb
WHERE id = 5;
