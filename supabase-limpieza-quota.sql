-- Limpieza de cuota en Supabase (SQL Editor)
-- Ejecuta primero las consultas de diagnóstico, luego el UPDATE si quieres liberar BD.
-- Las imágenes del bucket "notas-prensa" hay que borrarlas con: node scripts/limpiar-supabase.cjs

-- 1) Diagnóstico: tamaño de tablas
SELECT
  relname AS tabla,
  pg_size_pretty(pg_total_relation_size(relname::regclass)) AS tamano
FROM pg_stat_user_tables
WHERE relname IN ('notas_prensa', 'articulos', 'notas_prensa_imagenes', 'imagenes')
ORDER BY pg_total_relation_size(relname::regclass) DESC;

-- 2) Cuántas notas siguen guardando HTML pesado pese a estar ya publicadas/anuladas
SELECT COUNT(*) AS notas_con_html_sobrante
FROM notas_prensa n
JOIN articulos a ON a.nota_prensa_id = n.id
WHERE a.estado IN ('publicado', 'anulado')
  AND n.contenido_html IS NOT NULL;

-- 3) Cuántas filas de imágenes quedan en notas ya cerradas
SELECT COUNT(*) AS imagenes_huerfanas
FROM notas_prensa_imagenes i
JOIN articulos a ON a.nota_prensa_id = i.nota_prensa_id
WHERE a.estado IN ('publicado', 'anulado');

-- 4) Vaciar HTML de notas ya publicadas/anuladas (libera espacio en BD)
UPDATE notas_prensa n
SET contenido_html = NULL
FROM articulos a
WHERE a.nota_prensa_id = n.id
  AND a.estado IN ('publicado', 'anulado')
  AND n.contenido_html IS NOT NULL;

-- 5) Opcional: borrar notas descartadas muy antiguas (>90 días)
-- DELETE FROM notas_prensa
-- WHERE estado = 'descartada'
--   AND fecha_recepcion < NOW() - INTERVAL '90 days';
