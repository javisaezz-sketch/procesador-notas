-- Seguridad Supabase Advisor — ejecutar en Supabase → SQL Editor
--
-- QUÉ HACE:
-- Activa Row Level Security (RLS) en las tablas del panel.
-- Revoca acceso directo con la anon key (pública en el navegador).
--
-- QUÉ NO ROMPE:
-- El panel y el pipeline usan SUPABASE_SERVICE_ROLE_KEY en el servidor.
-- service_role ignora RLS y sigue funcionando igual.
--
-- IMPORTANTE: en Vercel debe estar configurada SUPABASE_SERVICE_ROLE_KEY
-- (no basta con SUPABASE_ANON_KEY).

-- 1) Activar RLS
ALTER TABLE public.notas_prensa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_prensa_imagenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imagenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medios ENABLE ROW LEVEL SECURITY;

-- 2) Revocar acceso anon/authenticated vía PostgREST
REVOKE ALL ON public.notas_prensa FROM anon, authenticated;
REVOKE ALL ON public.articulos FROM anon, authenticated;
REVOKE ALL ON public.notas_prensa_imagenes FROM anon, authenticated;
REVOKE ALL ON public.imagenes FROM anon, authenticated;
REVOKE ALL ON public.medios FROM anon, authenticated;

-- Secuencias (ids autoincrementales)
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 3) pipeline_estado (opcional; solo si creaste esa tabla)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pipeline_estado'
  ) THEN
    EXECUTE 'ALTER TABLE public.pipeline_estado ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON public.pipeline_estado FROM anon, authenticated';
  END IF;
END $$;

-- Comprobar: en Advisor deberían desaparecer los avisos "RLS Disabled in Public".
-- El panel en Vercel debe seguir cargando artículos con normalidad.
