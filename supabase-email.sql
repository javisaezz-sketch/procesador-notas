-- Copia TODO esto en Supabase → SQL Editor → Run

ALTER TABLE notas_prensa
ADD COLUMN IF NOT EXISTS estado VARCHAR(50) DEFAULT 'recibida';

ALTER TABLE notas_prensa
ADD COLUMN IF NOT EXISTS contenido_html TEXT;

ALTER TABLE notas_prensa
ADD COLUMN IF NOT EXISTS email_message_id VARCHAR(255);

ALTER TABLE articulos
ADD COLUMN IF NOT EXISTS imagen_destacada_url TEXT;

CREATE TABLE IF NOT EXISTS notas_prensa_imagenes (
  id SERIAL PRIMARY KEY,
  nota_prensa_id INT4 REFERENCES notas_prensa(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  nombre_archivo VARCHAR(255),
  origen VARCHAR(50) DEFAULT 'adjunto',
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS imagenes (
  id SERIAL PRIMARY KEY,
  medio_id INT4 REFERENCES medios(id),
  url TEXT NOT NULL,
  titulo VARCHAR(255),
  activa BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-prensa', 'notas-prensa', true)
ON CONFLICT (id) DO NOTHING;

UPDATE notas_prensa SET estado = 'recibida' WHERE estado IS NULL;
