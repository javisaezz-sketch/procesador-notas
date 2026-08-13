-- Ejecuta esto en Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS imagenes (
  id SERIAL PRIMARY KEY,
  medio_id INT4 REFERENCES medios(id),
  url TEXT NOT NULL,
  titulo VARCHAR(255),
  activa BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

ALTER TABLE articulos
ADD COLUMN IF NOT EXISTS imagen_destacada_url TEXT;

-- Ejemplos (cambia las URLs por las tuyas):
-- INSERT INTO imagenes (medio_id, url, titulo) VALUES
-- (1, 'https://ejemplo.com/foto1.jpg', 'Playa verano'),
-- (1, 'https://ejemplo.com/foto2.jpg', 'Ciudad'),
-- (1, 'https://ejemplo.com/foto3.jpg', 'Moda');
