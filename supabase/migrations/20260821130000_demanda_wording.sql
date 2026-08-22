-- Two corrections to the demanda body, found by generating one end to end.
--
-- Template text lives in the database precisely so it can be corrected without a
-- deploy (Part D of the Week 2B plan), so wording fixes are UPDATE migrations.
-- This is the first of them; the ones that come out of Fran's diff against
-- DEMANDA.docx take the same shape.
--
--   1. ANTECEDENTES joined the card list with a {{SEP}} token that is
--      legitimately empty on the last party — and an empty token is exactly what
--      the engine renders as a visible [SEP] marker. Replaced with two {{#if}}s,
--      which say the same thing without ever asking for an empty value.
--
--   2. Section XII printed "al Dr. {{JUEZ}}", but 261 of the 292 juzgados rows
--      already carry "Dr."/"Dra." in the juez field, so it read "al Dr. Dr. X".
--      The title comes from the data, which also gets the feminine form right.

UPDATE public.escritos_templates
   SET contenido = replace(
         contenido,
         '{{#each PARTES}}{{TARJETA_CABAL}} ({{NOMBRE}}){{SEP}}{{/each}}',
         '{{#each PARTES}}{{TARJETA_CABAL}} ({{NOMBRE}}){{#if SEP_Y}} y {{/if}}{{#if SEP_COMA}}, {{/if}}{{/each}}'
       )
 WHERE clave = 'demanda.cobro-ejecutivo';

UPDATE public.escritos_templates
   SET contenido = replace(
         contenido,
         'recusar sin expresión de causa al Dr. {{JUEZ}}, Juez titular del',
         'recusar sin expresión de causa a {{JUEZ}}, Juez titular del'
       )
 WHERE clave = 'demanda.cobro-ejecutivo';

DO $$
DECLARE
  restantes INTEGER;
BEGIN
  SELECT count(*) INTO restantes
    FROM public.escritos_templates
   WHERE clave = 'demanda.cobro-ejecutivo'
     AND (contenido LIKE '%{{SEP}}%' OR contenido LIKE '%al Dr. {{JUEZ}}%');
  IF restantes > 0 THEN
    RAISE EXCEPTION 'demanda body did not match the expected text; corrections not applied';
  END IF;
  RAISE NOTICE 'demanda body corrected';
END $$;
