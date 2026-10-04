ALTER TABLE public.articulos
  ADD COLUMN IF NOT EXISTS fecha_programada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_evento DATE,
  ADD COLUMN IF NOT EXISTS categoria_slug VARCHAR(80),
  ADD COLUMN IF NOT EXISTS articulo_origen_id INT;

CREATE INDEX IF NOT EXISTS articulos_programados_idx
  ON public.articulos (fecha_programada)
  WHERE estado = 'programado';
