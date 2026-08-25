-- Ejecutar en Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS pipeline_estado (
  id INT PRIMARY KEY DEFAULT 1,
  ok BOOLEAN DEFAULT true,
  ejecutado_en TIMESTAMPTZ DEFAULT NOW(),
  emails_nuevas INT DEFAULT 0,
  articulos_generados INT DEFAULT 0,
  notas_reactivadas INT DEFAULT 0,
  advertencias JSONB DEFAULT '[]'::jsonb,
  fatal JSONB
);

INSERT INTO pipeline_estado (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
