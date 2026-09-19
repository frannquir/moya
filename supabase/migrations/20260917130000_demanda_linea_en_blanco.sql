-- The blank line belongs INSIDE the conditional block, not after it.
--
-- Found reviewing package A by replaying the whole migration chain on an empty
-- Postgres and rendering the stored body with the real engine. Pre-existing
-- since 20260831120000 made section XII conditional; A did not introduce it and
-- did not catch it either.
--
-- A standalone block tag consumes its own line, so a body shaped
--
--     ...vigente.-\n\n{{#if X}}\n...{{SECCION}}.- RECUSA...\n{{/if}}\n\n{{SECCION}}.- PETICIÓN
--
-- renders, when X is false, as "...vigente.-\n\n" + "\n{{SECCION}}.- PETICIÓN" —
-- three newlines, i.e. a doubled blank line in the filing. Moving the blank line
-- inside the block makes both branches produce exactly one:
--
--     true  -> ...DEPARTAMENTO.-\n\nXII.- PETICIÓN
--     false -> ...vigente.-\n\nXI.- PETICIÓN
--
-- TWO blocks have this shape, not one. The second — the cláusula quinta rider in
-- ANTECEDENTES, gated on HAY_CODEMANDADOS — hits every demanda with a single
-- debtor, which is most of them. Both are fixed here because the regression test
-- that ships with this asserts the rendered document contains no "\n\n\n" at
-- all, and half a fix would make that assertion a lie.
--
-- Measured before and after with renderTemplate over the stored body, in all
-- four combinations of the two conditions: 2 / 1 / 1 / 0 doubled gaps today,
-- 0 / 0 / 0 / 0 after. Nothing else in the document moves.
--
-- Line endings: these rows were normalised to bare newlines by 20260831120000.
-- The literals below are written the same way (gotcha #1: every value trails a
-- comma, so no two literals sit adjacent).

-- --- 1. the recusación block, before PETICIÓN ------------------------------

UPDATE public.escritos_templates
   SET contenido = replace(contenido, '{{DEPARTAMENTO}}.-
{{/if}}

{{SECCION}}.- PETICIÓN.-', '{{DEPARTAMENTO}}.-

{{/if}}
{{SECCION}}.- PETICIÓN.-')
 WHERE clave = 'demanda.cobro-ejecutivo';

-- --- 2. the codemandados rider, inside ANTECEDENTES -----------------------

UPDATE public.escritos_templates
   SET contenido = replace(contenido, 'principales pagadores.-
{{/if}}

La ejecutada comenzó', 'principales pagadores.-

{{/if}}
La ejecutada comenzó')
 WHERE clave = 'demanda.cobro-ejecutivo';

-- --- verification ---------------------------------------------------------

DO $$
DECLARE
  dem       TEXT;
  secciones INTEGER;
BEGIN
  SELECT contenido INTO dem FROM public.escritos_templates
   WHERE clave = 'demanda.cobro-ejecutivo';

  IF dem IS NULL THEN
    RAISE EXCEPTION 'demanda.cobro-ejecutivo not found; 20260821120000 must run first';
  END IF;

  -- 1. the new shape, exactly once each. A replace that matched nothing is
  -- silent, so this is the only thing standing between a no-op and a lie.
  IF (length(dem) - length(replace(dem, '{{DEPARTAMENTO}}.-

{{/if}}
{{SECCION}}.- PETICIÓN.-', ''))) / length('{{DEPARTAMENTO}}.-

{{/if}}
{{SECCION}}.- PETICIÓN.-') <> 1 THEN
    RAISE EXCEPTION 'the recusación block does not carry its blank line exactly once';
  END IF;
  IF (length(dem) - length(replace(dem, 'principales pagadores.-

{{/if}}
La ejecutada comenzó', ''))) / length('principales pagadores.-

{{/if}}
La ejecutada comenzó') <> 1 THEN
    RAISE EXCEPTION 'the codemandados rider does not carry its blank line exactly once';
  END IF;

  -- 2. and the old shape is gone.
  IF dem LIKE '%' || '{{DEPARTAMENTO}}.-
{{/if}}

{{SECCION}}.- PETICIÓN.-' || '%' OR dem LIKE '%' || 'principales pagadores.-
{{/if}}

La ejecutada comenzó' || '%' THEN
    RAISE EXCEPTION 'the old blank-line placement survived in the demanda body';
  END IF;

  -- 3. nothing was added or lost: the count is derived from the body, never
  -- assumed (gotcha #50 — 20260831120000 shipped asserting a number nobody had
  -- counted, and aborted on every database that really ran it).
  secciones := (length(dem) - length(replace(dem, '{SECCION}', ''))) / length('{SECCION}');
  IF secciones <> 11 THEN
    RAISE EXCEPTION 'expected 11 {SECCION} tokens in the demanda body, found %', secciones;
  END IF;

  -- 4. the body itself must not carry a doubled blank line either.
  IF dem LIKE '%' || chr(10) || chr(10) || chr(10) || '%' THEN
    RAISE EXCEPTION 'the demanda body has a doubled blank line of its own';
  END IF;

  -- 5. and every block still closes.
  IF (length(dem) - length(replace(dem, '{#if', ''))) / length('{#if')
     <> (length(dem) - length(replace(dem, '{/if}', ''))) / length('{/if}') THEN
    RAISE EXCEPTION 'the demanda has an unbalanced {#if} block';
  END IF;

  RAISE NOTICE 'demanda: both conditional blocks now own their blank line; % sections', secciones;
END $$;
