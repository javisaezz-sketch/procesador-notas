-- Proyecto Supabase NUEVO (vacío) — pegar en SQL Editor → Run
-- Después: npm run bootstrap-proyecto-nuevo (con .env actualizado)

CREATE TABLE IF NOT EXISTS public.medios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  slug VARCHAR(50) UNIQUE,
  color VARCHAR(20) DEFAULT 'indigo',
  prompt_personalidad TEXT,
  url_wordpress TEXT,
  api_user TEXT,
  api_password TEXT,
  email_pop_user VARCHAR(255),
  email_pop_password TEXT,
  email_pop_host VARCHAR(255),
  email_pop_port INT DEFAULT 110,
  email_pop_secure BOOLEAN DEFAULT false,
  categorias_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notas_prensa (
  id SERIAL PRIMARY KEY,
  remitente TEXT,
  asunto TEXT,
  contenido_original TEXT,
  contenido_html TEXT,
  estado VARCHAR(50) DEFAULT 'recibida',
  email_message_id VARCHAR(255),
  fecha_recepcion TIMESTAMPTZ DEFAULT NOW(),
  medio_id INT REFERENCES public.medios(id),
  error_mensaje TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS notas_prensa_email_message_id_key
  ON public.notas_prensa (email_message_id)
  WHERE email_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notas_prensa_estado_idx ON public.notas_prensa (estado);
CREATE INDEX IF NOT EXISTS notas_prensa_medio_id_idx ON public.notas_prensa (medio_id);

CREATE TABLE IF NOT EXISTS public.articulos (
  id SERIAL PRIMARY KEY,
  nota_prensa_id INT REFERENCES public.notas_prensa(id) ON DELETE SET NULL,
  medio_id INT REFERENCES public.medios(id),
  titulo_generado TEXT,
  contenido_generado TEXT,
  imagen_destacada_url TEXT,
  imagenes_publicar_urls JSONB,
  email_notificacion TEXT,
  estado VARCHAR(50) DEFAULT 'pendiente_revision',
  wp_post_id INT,
  wp_post_url TEXT,
  wp_post_status VARCHAR(20) DEFAULT 'draft',
  fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS articulos_estado_idx ON public.articulos (estado);
CREATE INDEX IF NOT EXISTS articulos_medio_id_idx ON public.articulos (medio_id);

CREATE TABLE IF NOT EXISTS public.notas_prensa_imagenes (
  id SERIAL PRIMARY KEY,
  nota_prensa_id INT REFERENCES public.notas_prensa(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  nombre_archivo VARCHAR(255),
  origen VARCHAR(50) DEFAULT 'adjunto',
  fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.imagenes (
  id SERIAL PRIMARY KEY,
  medio_id INT REFERENCES public.medios(id),
  url TEXT NOT NULL,
  titulo VARCHAR(255),
  activa BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pipeline_estado (
  id INT PRIMARY KEY DEFAULT 1,
  ok BOOLEAN DEFAULT true,
  ejecutado_en TIMESTAMPTZ DEFAULT NOW(),
  emails_nuevas INT DEFAULT 0,
  articulos_generados INT DEFAULT 0,
  notas_reactivadas INT DEFAULT 0,
  advertencias JSONB DEFAULT '[]'::jsonb,
  fatal JSONB
);

INSERT INTO public.pipeline_estado (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-prensa', 'notas-prensa', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Service role full access notas-prensa" ON storage.objects;
CREATE POLICY "Service role full access notas-prensa"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'notas-prensa')
WITH CHECK (bucket_id = 'notas-prensa');

ALTER TABLE public.medios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_prensa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_prensa_imagenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imagenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_estado ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.medios FROM anon, authenticated;
REVOKE ALL ON public.notas_prensa FROM anon, authenticated;
REVOKE ALL ON public.articulos FROM anon, authenticated;
REVOKE ALL ON public.notas_prensa_imagenes FROM anon, authenticated;
REVOKE ALL ON public.imagenes FROM anon, authenticated;
REVOKE ALL ON public.pipeline_estado FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
