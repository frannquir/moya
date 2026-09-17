-- Package A: the demanda drops its copias-para-traslado section, and the
-- convenio's opening paragraph identifies the apoderado the way every other
-- escrito does.
--
-- One migration for both, because both rewrite a row of public.escritos_templates
-- and that table is SELECT-only from the app (locked decision #17) - template text
-- changes by SQL or not at all. Guarded the way 20260821130000 and 20260831120000
-- are: every replacement is asserted at the end and the whole file aborts rather
-- than leaving a half-rewritten filing behind.
--
-- Line endings: 20260831120000 normalised these rows to bare newlines. The
-- literals below are written the same way and nothing is re-normalised.

-- --- 1. demanda: delete "MANIFIESTA SOBRE COPIA PARA TRASLADO" ---------------
--
-- Fran, 2026-09-15: "Delete 'INCISO XI.' from escrito Demanda ... but leave XI as
-- the following, so do not leave the gap X to XII."
--
-- No numeral is edited anywhere. Since 20260831120000 every heading is
-- {{SECCION}} and the engine numbers the ones it actually renders, so removing a
-- section closes the sequence over it by construction: DERECHO stays X and
-- whatever follows becomes XI.
--
-- The heading, its blank line, its paragraph AND the blank line after it go in
-- one replacement, so the blank-line rhythm around the hole is preserved instead
-- of leaving a double gap where the section used to be.
--
-- LEFT ALONE, DELIBERATELY: item 5 of PETICION reads "Se decrete la medida
-- cautelar peticionada en el Punto VII". That VII is literal prose, not a
-- {{SECCION}} - the token increments on every read, so it cannot restate a
-- number captured earlier. It is still correct after this change (the cautelar
-- is spliced in at position 7 and everything removed here sits below it), but it
-- is coupled to the cautelar's position: MOVING OR REMOVING ANY SECTION ABOVE
-- THE CAUTELAR SILENTLY BREAKS IT.

UPDATE public.escritos_templates
   SET contenido = replace(contenido, '{{SECCION}}.- MANIFIESTA SOBRE COPIA PARA TRASLADO.-

Teniendo en cuenta que las copias para traslado son reservadas en Secretaría por el exiguo término de tres meses y que en dicho plazo no se podrá librar el mandamiento de intimación de pago y embargo en autos cuyas copias deben agregarse, ya que resulta materialmente imposible preparar la vía ejecutiva solicitada antes de dicho término; sumado a que en el plazo estipulado por la Acordada 3886 se acompañará copia digital del escrito de inicio y documentación adjuntada, por lo tanto la misma podrá ser consultada por cualquier interesado a través de la Mesa de Entrada Virtual o podrá compulsar los originales en Secretaría; a los fines de evitar acumular documentación innecesaria en Secretaría, como así también evitar un gasto innecesario a mi mandante a los fines de acompañar copias que serán desechadas vencidos los plazos que fija la Reglamentación del art. 120 del C.P.C.C., vengo a solicitar se tenga presente que las copias para traslado se adjuntarán oportunamente al mandamiento de intimación de pago y embargo que se librará en autos una vez preparada la vía.-

', '')
 WHERE clave = 'demanda.cobro-ejecutivo';

-- --- 2. convenio: the apoderado's full identification -----------------------
--
-- Fran, 2026-09-15: "The encabezado we use on other escritos has information the
-- Demanda one doesn't ... we should work both on the encabezado, and in the
-- convenio." Read against the repo it is the other way round: the demanda's
-- encabezado is complete, and the CONVENIO's opening is the thin one. It named
-- the apoderado by D.N.I. and nothing else, missing matricula, legajo
-- previsional, CUIT, IBM, condicion de IVA, domicilio electronico and telefono.
--
-- Not a mechanical {{ENCABEZADO}} substitution: a convenio is signed by a debtor,
-- not filed, so it reads "Entre X ... y Z, convienen celebrar" and never "ante
-- V.S. respetuosamente digo". The fields are the encabezado's; the sentence is
-- the convenio's own.
--
-- Three decisions from Fran, 2026-09-17, because his two example documents
-- disagreed with each other:
--   * the apoderado is identified by CUIT, as in every other escrito. The D.N.I.
--     clause goes away, and with it the last use of {{ABOGADO_DNI}} in any
--     template (the token still resolves; nothing asks for it any more).
--   * the domicilios do NOT gain "de la ciudad de ...". Neither
--     domicilios_procesales nor ejecutados.domicilio is guaranteed to carry a
--     city, and appending the case's departamento to the DEBTOR's address would
--     print a city that may simply be false. A head who wants the city writes it
--     into the domicilio procesal of that departamento, where the value is
--     per-department and correct by construction.
--   * the caratula gains " Y OTRO/A" when the case has codemandados, matching
--     the expediente. The convenio still names one deudor - this changes the
--     caption, not the parties.

UPDATE public.escritos_templates
   SET contenido = replace(contenido, 'Entre {{ABOGADO_NOMBRE}}, D.N.I. N° {{ABOGADO_DNI}}, con domicilio en la {{DOMICILIO_PROCESAL}}, en su carácter de letrado apoderado de {{EMPRESA}}, tal como se acredita con copia simple del poder general para asuntos judiciales adjuntado, en adelante denominado EL ACREEDOR; y {{DEMANDADO}}, D.N.I. N° {{DNI_DEMANDADO}}, con domicilio en {{DOMICILIO}}, por derecho propio, en adelante denominado EL DEUDOR; en autos caratulados "{{EMPRESA}} C/ {{DEMANDADO_MAYUSCULA}} S/ COBRO EJECUTIVO", Expte. N° {{EXPEDIENTE}}, de trámite ante el {{JUZGADO}}, convienen celebrar el presente convenio de reconocimiento y refinanciación de deuda de acuerdo a las siguientes cláusulas:', 'Entre {{ABOGADO_NOMBRE}}, abogado inscripto al {{ABOGADO_MATRICULA}}, Legajo Previsional nº {{ABOGADO_LEGAJO}}, CUIT N° {{ABOGADO_CUIT}}, IBM N° {{ABOGADO_IBM}}, IVA {{ABOGADO_IVA}}, con domicilio en la {{DOMICILIO_PROCESAL}} y domicilio electrónico en {{ABOGADO_DOMICILIO_ELECTRONICO}}, Teléfono de contacto: {{ABOGADO_TELEFONO}}, en su carácter de letrado apoderado de {{EMPRESA}}, tal como se acredita con copia simple del poder general para asuntos judiciales adjuntado, en adelante denominado EL ACREEDOR; y {{DEMANDADO}}, D.N.I. N° {{DNI_DEMANDADO}}, con domicilio en {{DOMICILIO}}, por derecho propio, en adelante denominado EL DEUDOR; en autos caratulados "{{EMPRESA}} C/ {{DEMANDADO_MAYUSCULA}}{{#if HAY_CODEMANDADOS}} Y OTRO/A{{/if}} S/ COBRO EJECUTIVO", Expte. N° {{EXPEDIENTE}}, de trámite ante el {{JUZGADO}}, convienen celebrar el presente convenio de reconocimiento y refinanciación de deuda de acuerdo a las siguientes cláusulas:')
 WHERE clave = 'convenio.reconocimiento-deuda';

-- --- verification -----------------------------------------------------------

DO $$
DECLARE
  dem       TEXT;
  cvn       TEXT;
  secciones INTEGER;
BEGIN
  SELECT contenido INTO dem FROM public.escritos_templates
   WHERE clave = 'demanda.cobro-ejecutivo';
  SELECT contenido INTO cvn FROM public.escritos_templates
   WHERE clave = 'convenio.reconocimiento-deuda';

  IF dem IS NULL OR cvn IS NULL THEN
    RAISE EXCEPTION 'demanda or convenio template missing; 20260821120000 and 20260823130000 must run first';
  END IF;

  -- 1a. the section is gone, heading and paragraph both.
  IF dem LIKE '%MANIFIESTA SOBRE COPIA%' OR dem LIKE '%copias para traslado son reservadas%' THEN
    RAISE EXCEPTION 'the copias-para-traslado section is still in the demanda';
  END IF;

  -- 1b. exactly one heading fewer. TWELVE went in, not eleven: 20260831120000
  -- tokenised eleven headings in step 1 and the recusacion in step 2, and the
  -- cautelar fragment brings a thirteenth of its own at render time. That
  -- migration's own check says 11 and is wrong; it is corrected in place there.
  secciones := (length(dem) - length(replace(dem, '{{SECCION}}', ''))) / length('{{SECCION}}');
  IF secciones <> 11 THEN
    RAISE EXCEPTION 'expected 11 {{SECCION}} tokens in the demanda body after the delete, found %', secciones;
  END IF;

  -- 1c. nothing around the hole collapsed or doubled.
  IF dem LIKE '%' || chr(10) || chr(10) || chr(10) || '%' THEN
    RAISE EXCEPTION 'the demanda body has a doubled blank line where the section was removed';
  END IF;
  IF dem NOT LIKE '%{{SECCION}}.- DERECHO.-' || chr(10) || chr(10) || 'Fundo el derecho%' THEN
    RAISE EXCEPTION 'DERECHO lost its paragraph';
  END IF;

  -- 1d. its neighbours, the cautelar splice point and the coupling above survive.
  IF dem NOT LIKE '%{{#if HAY_RECUSACION}}%'
     OR dem NOT LIKE '%{{JUEZ_RECUSADO}}%'
     OR dem NOT LIKE '%{{SECCION}}.- PETICIÓN.-%'
     OR dem NOT LIKE '%{{SECCION_CAUTELAR}}%'
     OR dem NOT LIKE '%peticionada en el Punto VII%' THEN
    RAISE EXCEPTION 'the demanda lost a section, the cautelar splice point, or the Punto VII reference';
  END IF;

  -- 2a. the convenio names the apoderado by CUIT, with the full identification.
  IF cvn NOT LIKE '%{{ABOGADO_MATRICULA}}%'
     OR cvn NOT LIKE '%{{ABOGADO_LEGAJO}}%'
     OR cvn NOT LIKE '%{{ABOGADO_CUIT}}%'
     OR cvn NOT LIKE '%{{ABOGADO_IBM}}%'
     OR cvn NOT LIKE '%{{ABOGADO_IVA}}%'
     OR cvn NOT LIKE '%{{ABOGADO_DOMICILIO_ELECTRONICO}}%'
     OR cvn NOT LIKE '%{{ABOGADO_TELEFONO}}%' THEN
    RAISE EXCEPTION 'the convenio opening did not gain the apoderado fields; the paragraph did not match';
  END IF;
  IF cvn LIKE '%{{ABOGADO_DNI}}%' THEN
    RAISE EXCEPTION 'the convenio still identifies the apoderado by D.N.I.';
  END IF;

  -- 2b. the DEBTOR keeps his, and the rest of the opening is intact.
  IF cvn NOT LIKE '%{{DNI_DEMANDADO}}%'
     OR cvn NOT LIKE '%{{DOMICILIO_PROCESAL}}%'
     OR cvn NOT LIKE '%en adelante denominado EL ACREEDOR%'
     OR cvn NOT LIKE '%en adelante denominado EL DEUDOR%' THEN
    RAISE EXCEPTION 'the convenio opening lost the deudor, the domicilio or a party label';
  END IF;

  -- 2c. the caratula is conditional, and every block tag still closes.
  IF cvn NOT LIKE '%{{#if HAY_CODEMANDADOS}} Y OTRO/A{{/if}} S/ COBRO EJECUTIVO%' THEN
    RAISE EXCEPTION 'the convenio caratula did not gain the conditional Y OTRO/A';
  END IF;
  IF (length(cvn) - length(replace(cvn, '{{#if', ''))) / length('{{#if')
     <> (length(cvn) - length(replace(cvn, '{{/if}}', ''))) / length('{{/if}}') THEN
    RAISE EXCEPTION 'the convenio has an unbalanced {{#if}} block';
  END IF;

  RAISE NOTICE 'demanda: copias section removed, % sections left in the body; convenio: apoderado identified by CUIT', secciones;
END $$;
