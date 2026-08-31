-- Self-numbering sections, and the recusación becomes conditional.
--
-- Two changes that only make sense together:
--
--   1. Section XII ("RECUSA SIN EXPRESIÓN DE CAUSA") was unconditional, so every
--      demanda recused the sitting judge — the name coming from juzgados.juez,
--      which is populated for essentially all 292 courts. The firm recuses only
--      specific judges, so it is now gated on
--      estudios.escritos_config.jueces_recusados (juzgados.id -> name) and prints
--      THAT name via {{JUEZ_RECUSADO}}. No entry for the case's court, no section.
--
--   2. Making a section optional broke the numbering: the numerals were literal
--      text, so dropping XII made the filing read X, XI, XIII. Every heading now
--      uses {{SECCION}}, a token the engine answers itself by counting the ones it
--      actually renders. A section inside a false {{#if}} never increments, so the
--      sequence closes over the gap and PETICIÓN moves up from XIII to XII.
--
-- The cautelar fragment's own heading (VII) is included: escrito-render splices
-- the fragment into the body BEFORE rendering now, so one pass numbers the whole
-- document in order. Rendering it separately, as before, would have restarted the
-- counter at I.
--
-- Template text lives in the database so it can be corrected without a deploy, so
-- this is an UPDATE migration, guarded the same way 20260821130000 is: every
-- replacement is verified at the end and the whole thing aborts if the body did
-- not match, rather than leaving a half-rewritten demanda.

-- --- 0. line endings -------------------------------------------------------
-- 20260821120000 was authored with Windows line endings, so these bodies are
-- stored with a carriage return before every newline while every string literal
-- below is written with bare newlines. Normalising first makes the replacements
-- deterministic instead of dependent on how the seed file happened to be saved.
-- The engine copes with either (stripStandaloneLines matches an optional
-- carriage return), so this changes no rendered output — only the stored bytes,
-- and only for the four rows this migration rewrites.

UPDATE public.escritos_templates
   SET contenido = replace(contenido, chr(13) || chr(10), chr(10))
 WHERE clave IN (
   'demanda.cobro-ejecutivo',
   'cautelar.haberes',
   'cautelar.mercadopago',
   'cautelar.mixto'
 );

-- --- 1. the demanda body: literal numerals -> {{SECCION}} -------------------
-- Each heading carries its own title, so these are unambiguous full-string
-- replacements. Replacing a bare "I.-" would also hit II, III, VII and VIII.

UPDATE public.escritos_templates SET contenido =
  replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    contenido,
    'I.- PERSONERIA.-',            '{{SECCION}}.- PERSONERIA.-'),
    'II.- OBJETO.-',               '{{SECCION}}.- OBJETO.-'),
    'III.- ANTECEDENTES.-',        '{{SECCION}}.- ANTECEDENTES.-'),
    'IV.- PREPARACION DE LA VIA EJECUTIVA.-',
                                   '{{SECCION}}.- PREPARACION DE LA VIA EJECUTIVA.-'),
    'V.- PRUEBA.-',                '{{SECCION}}.- PRUEBA.-'),
    'VI.- MANIFIESTA RESPECTO A LA DOCUMENTACION ACOMPAÑADA.-',
                                   '{{SECCION}}.- MANIFIESTA RESPECTO A LA DOCUMENTACION ACOMPAÑADA.-'),
    'VIII.- SE EXIMA DE PRESTAR CAUCION. SUBSIDIARIAMENTE PRESTA CAUCION JURATORIA EN ESTE ACTO.-',
                                   '{{SECCION}}.- SE EXIMA DE PRESTAR CAUCION. SUBSIDIARIAMENTE PRESTA CAUCION JURATORIA EN ESTE ACTO.-'),
    'IX.- AUTORIZADOS.-',          '{{SECCION}}.- AUTORIZADOS.-'),
    'X.- DERECHO.-',               '{{SECCION}}.- DERECHO.-'),
    'XI.- MANIFIESTA SOBRE COPIA PARA TRASLADO.-',
                                   '{{SECCION}}.- MANIFIESTA SOBRE COPIA PARA TRASLADO.-'),
    'XIII.- PETICIÓN.-',           '{{SECCION}}.- PETICIÓN.-')
 WHERE clave = 'demanda.cobro-ejecutivo';

-- Careful with ordering: 'I.- PERSONERIA.-' above is a full-title match, so it
-- cannot have touched 'II.-'/'III.-'. 'XIII.- PETICIÓN.-' is replaced before the
-- XII block below is rewritten, so neither can shadow the other.

-- --- 2. section XII becomes conditional -------------------------------------
-- {{#if}} / {{/if}} sit alone on their lines: stripStandaloneLines removes the
-- whole line when a block tag is the only thing on it, so the blank-line rhythm
-- of the document is preserved whether the section renders or not.

UPDATE public.escritos_templates SET contenido = replace(
    contenido,
    'XII.- RECUSA SIN EXPRESIÓN DE CAUSA.-

Que siguiendo precisas instrucciones de mi mandante, conforme art. 14 C.P.C.C.B.A vengo por el presente a recusar sin expresión de causa a {{JUEZ}}, Juez titular del {{JUZGADO}} de la ciudad de {{JUZGADO_LOCALIDAD}}, Departamento Judicial de {{DEPARTAMENTO}}.-',
    '{{#if HAY_RECUSACION}}
{{SECCION}}.- RECUSA SIN EXPRESIÓN DE CAUSA.-

Que siguiendo precisas instrucciones de mi mandante, conforme art. 14 C.P.C.C.B.A vengo por el presente a recusar sin expresión de causa a {{JUEZ_RECUSADO}}, Juez titular del {{JUZGADO}} de la ciudad de {{JUZGADO_LOCALIDAD}}, Departamento Judicial de {{DEPARTAMENTO}}.-
{{/if}}')
 WHERE clave = 'demanda.cobro-ejecutivo';

-- --- 3. the cautelar fragments' own heading --------------------------------
-- Spliced into the body before rendering, so it participates in the same count.

UPDATE public.escritos_templates
   SET contenido = replace(contenido, 'VII.- MEDIDA CAUTELAR:', '{{SECCION}}.- MEDIDA CAUTELAR:')
 WHERE clave IN ('cautelar.haberes', 'cautelar.mercadopago', 'cautelar.mixto');

-- --- verification ----------------------------------------------------------

DO $$
DECLARE
  cuerpo   TEXT;
  secciones INTEGER;
  frags    INTEGER;
BEGIN
  SELECT contenido INTO cuerpo
    FROM public.escritos_templates
   WHERE clave = 'demanda.cobro-ejecutivo';

  IF cuerpo IS NULL THEN
    RAISE EXCEPTION 'demanda.cobro-ejecutivo not found; migration 20260821120000 must run first';
  END IF;

  -- No literal numeral may survive. Checked as full headings, the same strings
  -- replaced above, so this cannot false-positive on prose containing "V.-".
  IF cuerpo LIKE '%' || chr(10) || 'I.- PERSONERIA%'
     OR cuerpo LIKE '%II.- OBJETO%'
     OR cuerpo LIKE '%III.- ANTECEDENTES%'
     OR cuerpo LIKE '%IV.- PREPARACION%'
     OR cuerpo LIKE '%V.- PRUEBA%'
     OR cuerpo LIKE '%VI.- MANIFIESTA RESPECTO%'
     OR cuerpo LIKE '%VIII.- SE EXIMA%'
     OR cuerpo LIKE '%IX.- AUTORIZADOS%'
     OR cuerpo LIKE '%X.- DERECHO%'
     OR cuerpo LIKE '%XI.- MANIFIESTA SOBRE COPIA%'
     OR cuerpo LIKE '%XII.- RECUSA%'
     OR cuerpo LIKE '%XIII.- PETICI%' THEN
    RAISE EXCEPTION 'demanda body still carries a literal section numeral; corrections not applied';
  END IF;

  -- Eleven headings live in the body; the twelfth (the cautelar) comes in with
  -- the spliced fragment.
  secciones := (length(cuerpo) - length(replace(cuerpo, '{{SECCION}}', ''))) / length('{{SECCION}}');
  IF secciones <> 11 THEN
    RAISE EXCEPTION 'expected 11 {{SECCION}} tokens in the demanda body, found %', secciones;
  END IF;

  IF cuerpo NOT LIKE '%{{#if HAY_RECUSACION}}%' OR cuerpo NOT LIKE '%{{JUEZ_RECUSADO}}%' THEN
    RAISE EXCEPTION 'the recusación section was not made conditional';
  END IF;

  -- {{JUEZ}} was only ever used by section XII; nothing else may still ask for it.
  IF cuerpo LIKE '%{{JUEZ}}%' THEN
    RAISE EXCEPTION 'the demanda still resolves {{JUEZ}}, which now recuses on every case';
  END IF;

  SELECT count(*) INTO frags
    FROM public.escritos_templates
   WHERE clave IN ('cautelar.haberes', 'cautelar.mercadopago', 'cautelar.mixto')
     AND contenido LIKE '{{SECCION}}.- MEDIDA CAUTELAR:%';
  IF frags <> 3 THEN
    RAISE EXCEPTION 'expected 3 cautelar fragments to carry {{SECCION}}, found %', frags;
  END IF;

  RAISE NOTICE 'demanda sections now self-number; recusación is conditional';
END $$;
