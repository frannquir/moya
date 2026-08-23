-- Closing the fojas, the last unbuilt piece of the demanda.
--
-- The two source demandas were diffed word by word (Fran, 2026-08-22): their
-- DOCUMENTAL blocks are identical except for a single number, the resúmenes de
-- cuenta. The client confirmed only that one varies, because it follows how many
-- months of statements are attached.
--
-- So two of the three fojas counts stop being questions:
--   * contrato y anexo — always 14 fs.
--   * acuse de recibo  — always  2 fs.
-- Both become literals in the template body (the UPDATE-migration pattern
-- 20260821130000_demanda_wording.sql established), and both come out of
-- MANUAL_INPUT_TOKENS in lib/domain/template-engine.ts.
--
-- FOJAS_RESUMENES survives, but as a STORED COLUMN rather than a generate-time
-- input: "Generar de nuevo" recomposes the demanda from current data, so an
-- unstored value would blank itself on every regeneration — exactly what
-- happened to `empresa`.


-- ---------------------------------------------------------------------------
-- The two invariant counts, inlined
-- ---------------------------------------------------------------------------

UPDATE public.escritos_templates
   SET contenido = replace(contenido, '{{FOJAS_CONTRATO}}', '14')
 WHERE clave = 'demanda.cobro-ejecutivo';

UPDATE public.escritos_templates
   SET contenido = replace(contenido, '{{FOJAS_ACUSE}}', '2')
 WHERE clave = 'demanda.cobro-ejecutivo';

DO $$
DECLARE
  restantes INTEGER;
BEGIN
  SELECT count(*) INTO restantes
    FROM public.escritos_templates
   WHERE clave = 'demanda.cobro-ejecutivo'
     AND (contenido LIKE '%{{FOJAS_CONTRATO}}%' OR contenido LIKE '%{{FOJAS_ACUSE}}%');
  IF restantes > 0 THEN
    RAISE EXCEPTION 'demanda body still carries a FOJAS_CONTRATO / FOJAS_ACUSE token; the inlining did not apply';
  END IF;

  -- The one that stays a token. If this is gone the demanda lost its only
  -- variable foja count and nobody would notice until a filing.
  SELECT count(*) INTO restantes
    FROM public.escritos_templates
   WHERE clave = 'demanda.cobro-ejecutivo'
     AND contenido LIKE '%{{FOJAS_RESUMENES}}%';
  IF restantes <> 1 THEN
    RAISE EXCEPTION 'demanda body no longer carries {{FOJAS_RESUMENES}}';
  END IF;

  RAISE NOTICE 'fojas de contrato (14) and acuse (2) inlined in the demanda body';
END $$;


-- ---------------------------------------------------------------------------
-- The one that varies, as a column
-- ---------------------------------------------------------------------------

-- NULL allowed: every case created before this predates the field, and the
-- demanda prints a visible [FOJAS_RESUMENES] marker for those rather than
-- inventing a count. The range is a sanity bound, not a domain rule — the firm
-- has no fixed set of values, which is why the form is a number input and not a
-- dropdown (Fran, 2026-08-22).
ALTER TABLE public.ejecutados
  ADD COLUMN fojas_resumenes INTEGER CHECK (fojas_resumenes BETWEEN 1 AND 30);

COMMENT ON COLUMN public.ejecutados.fojas_resumenes IS
  'Fojas de resúmenes de cuenta attached to the demanda. The only DOCUMENTAL count that varies between cases; contrato (14) and acuse (2) are literals in the template body.';
