-- Ejecutar en Supabase → SQL Editor

ALTER TABLE articulos
ADD COLUMN IF NOT EXISTS wp_post_id INT4,
ADD COLUMN IF NOT EXISTS wp_post_url TEXT;

ALTER TABLE notas_prensa
ADD COLUMN IF NOT EXISTS error_mensaje TEXT;

ALTER TABLE articulos
ADD COLUMN IF NOT EXISTS imagenes_publicar_urls JSONB;

ALTER TABLE articulos
ADD COLUMN IF NOT EXISTS email_notificacion TEXT;

ALTER TABLE articulos
ADD COLUMN IF NOT EXISTS wp_post_status VARCHAR(20) DEFAULT 'draft';
