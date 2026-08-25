-- Seguridad Supabase Advisor — ejecutar en SQL Editor
--
-- El panel y el pipeline usan SUPABASE_SERVICE_ROLE_KEY en el servidor.
-- service_role bypass RLS automáticamente.
-- Sin políticas para anon = nadie puede leer tablas con la anon key.

ALTER TABLE public.notas_prensa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_prensa_imagenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imagenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medios ENABLE ROW LEVEL SECURITY;

-- Si ya creaste pipeline_estado (supabase-pipeline-estado.sql):
ALTER TABLE public.pipeline_estado ENABLE ROW LEVEL SECURITY;

-- Opcional: revocar acceso directo anon/authenticated vía PostgREST
REVOKE ALL ON public.notas_prensa FROM anon, authenticated;
REVOKE ALL ON public.articulos FROM anon, authenticated;
REVOKE ALL ON public.notas_prensa_imagenes FROM anon, authenticated;
REVOKE ALL ON public.imagenes FROM anon, authenticated;
REVOKE ALL ON public.medios FROM anon, authenticated;
REVOKE ALL ON public.pipeline_estado FROM anon, authenticated;

-- Secuencias (ids autoincrementales)
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
