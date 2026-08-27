-- Trim stray whitespace from ejecutados.nombre: 14 rows leading, 25 trailing,
-- all from the import. Postgres sorts " RIGO MARIA" before "ACOSTA", so they
-- floated to the top of the A-Z list. One-time backfill —
-- parseEjecutadoFormData already trims everything the app writes.

-- updated_at trigger stays off: /escritos ranks by it (gotcha #38), so touching
-- 39 rows would report them as today's work.
ALTER TABLE public.ejecutados DISABLE TRIGGER trg_ejecutados_updated_at;

DO $$
DECLARE
  afectadas INTEGER;
BEGIN
  UPDATE public.ejecutados
     SET nombre = btrim(nombre)
   WHERE nombre IS NOT NULL
     AND nombre <> btrim(nombre);
  GET DIAGNOSTICS afectadas = ROW_COUNT;
  RAISE NOTICE 'nombres trimmed: %', afectadas;
END $$;

ALTER TABLE public.ejecutados ENABLE TRIGGER trg_ejecutados_updated_at;

-- Same import script, same treatment.
ALTER TABLE public.codemandados DISABLE TRIGGER trg_codemandados_updated_at;

DO $$
DECLARE
  afectadas INTEGER;
BEGIN
  UPDATE public.codemandados
     SET nombre = btrim(nombre)
   WHERE nombre IS NOT NULL
     AND nombre <> btrim(nombre);
  GET DIAGNOSTICS afectadas = ROW_COUNT;
  RAISE NOTICE 'codemandado nombres trimmed: %', afectadas;
END $$;

ALTER TABLE public.codemandados ENABLE TRIGGER trg_codemandados_updated_at;
