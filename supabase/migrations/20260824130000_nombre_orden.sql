-- Case-insensitive ordering for /ejecutados: "Acosta, Alejandra" sorted after
-- "ACOSTA PABLO" under the database collation, and the imported names are mixed.
--
-- PostgREST's .order() takes a column, not an expression, so `order by
-- lower(nombre)` is not reachable from the client. lower() and btrim() are both
-- immutable, so a STORED generated column stays in step on its own. btrim()
-- covers a row arriving untrimmed after 20260824120000.

ALTER TABLE public.ejecutados
  ADD COLUMN nombre_orden TEXT
    GENERATED ALWAYS AS (lower(btrim(nombre))) STORED;

COMMENT ON COLUMN public.ejecutados.nombre_orden IS
  'Sort key for case-insensitive alphabetical ordering. Generated from nombre; never written directly.';

CREATE INDEX idx_ejecutados_nombre_orden
  ON public.ejecutados(nombre_orden) WHERE archived_at IS NULL;

DO $$
DECLARE
  muestra TEXT;
BEGIN
  SELECT string_agg(nombre, ' | ' ORDER BY nombre_orden) INTO muestra
    FROM (
      SELECT nombre, nombre_orden FROM public.ejecutados
       WHERE archived_at IS NULL AND nombre_orden LIKE 'acosta%'
       ORDER BY nombre_orden LIMIT 4
    ) t;
  RAISE NOTICE 'acosta rows in the new order: %', coalesce(muestra, '(none)');
END $$;
