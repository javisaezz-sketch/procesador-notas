-- Reducir egress: hacer privado el bucket de imágenes
-- Ejecutar en Supabase → SQL Editor
--
-- Antes el bucket era público: cualquiera con la URL podía descargar imágenes
-- (panel, bots, hotlinking) y eso consume egress.
--
-- Tras esto, el panel usa URLs firmadas (código actualizado).
-- Despliega el panel en Vercel ANTES o JUSTO DESPUÉS de ejecutar esto.

UPDATE storage.buckets
SET public = false
WHERE id = 'notas-prensa';

-- Política: solo service_role puede leer/escribir (el pipeline y el panel en servidor)
-- Si ya tienes políticas conflictivas, revísalas en Storage → Policies.

DROP POLICY IF EXISTS "Service role full access notas-prensa" ON storage.objects;

CREATE POLICY "Service role full access notas-prensa"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'notas-prensa')
WITH CHECK (bucket_id = 'notas-prensa');
