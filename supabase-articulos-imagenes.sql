-- Ejecutar en Supabase → SQL Editor

ALTER TABLE articulos
ADD COLUMN IF NOT EXISTS imagenes_publicar_urls JSONB;

ALTER TABLE articulos
ADD COLUMN IF NOT EXISTS email_notificacion TEXT;
