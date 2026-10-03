-- Tabla para almacenar reseñas de Google Maps del usuario Local Guide
-- Pegar en el SQL Editor de Supabase y hacer clic en Run

CREATE TABLE IF NOT EXISTS public.google_maps_reviews (
  id SERIAL PRIMARY KEY,
  review_id TEXT UNIQUE NOT NULL,
  place_id TEXT,
  place_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  maps_url TEXT,
  stars INT DEFAULT 5,
  relative_date TEXT,
  fecha_resena TIMESTAMPTZ,
  texto_original TEXT,
  fotos JSONB DEFAULT '[]'::jsonb,
  estado VARCHAR(50) DEFAULT 'pendiente', -- 'pendiente', 'publicado', 'descartado'
  articulo_id INT REFERENCES public.articulos(id) ON DELETE SET NULL,
  instagram_post_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS google_maps_reviews_estado_idx ON public.google_maps_reviews (estado);
CREATE INDEX IF NOT EXISTS google_maps_reviews_review_id_idx ON public.google_maps_reviews (review_id);
CREATE INDEX IF NOT EXISTS google_maps_reviews_fecha_resena_idx ON public.google_maps_reviews (fecha_resena DESC);

ALTER TABLE public.google_maps_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_maps_reviews FROM anon, authenticated;
