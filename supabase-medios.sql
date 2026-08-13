-- Multi-medio: ejecutar en Supabase → SQL Editor → Run

ALTER TABLE medios
ADD COLUMN IF NOT EXISTS slug VARCHAR(50);

ALTER TABLE medios
ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT 'indigo';

ALTER TABLE medios
ADD COLUMN IF NOT EXISTS email_pop_user VARCHAR(255);

ALTER TABLE medios
ADD COLUMN IF NOT EXISTS email_pop_password TEXT;

ALTER TABLE medios
ADD COLUMN IF NOT EXISTS email_pop_host VARCHAR(255);

ALTER TABLE medios
ADD COLUMN IF NOT EXISTS email_pop_port INT DEFAULT 110;

ALTER TABLE medios
ADD COLUMN IF NOT EXISTS email_pop_secure BOOLEAN DEFAULT false;

ALTER TABLE medios
ADD COLUMN IF NOT EXISTS categorias_json JSONB;

ALTER TABLE notas_prensa
ADD COLUMN IF NOT EXISTS medio_id INT4 REFERENCES medios(id);

-- Slug único para Travelicius (medio 1)
UPDATE medios
SET slug = 'travelicius', color = 'indigo'
WHERE id = 1 AND slug IS NULL;

-- Asignar notas antiguas al primer medio
UPDATE notas_prensa
SET medio_id = (SELECT id FROM medios ORDER BY id LIMIT 1)
WHERE medio_id IS NULL;

-- Índice único parcial en slug (solo cuando no es null)
CREATE UNIQUE INDEX IF NOT EXISTS medios_slug_unique
ON medios (slug)
WHERE slug IS NOT NULL;
