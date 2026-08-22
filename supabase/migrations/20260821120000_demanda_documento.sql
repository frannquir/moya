-- Week 2B: the demanda document.
--
--   * escritos_templates.tipo discriminates library escritos from the pieces the
--     demanda is assembled out of, and from the demanda itself.
--   * Three medida cautelar fragments, selected by lib/domain/cautelar.ts.
--   * The demanda template, clave demanda.cobro-ejecutivo.
--
-- Bodies use the block syntax added to lib/domain/template-engine.ts in the same
-- session: {{#if NAME}}…{{else}}…{{/if}} and {{#each LIST}}…{{/each}}.
--
-- Wording is transcribed from the firm's MODELOS PARA MEDIDAS CAUTELARES and
-- DEMANDA.docx with the defects corrected rather than carried forward (see the
-- notes on each fragment). Names, CUILs, card numbers and amounts are tokens —
-- no client data ships in a migration.


-- ---------------------------------------------------------------------------
-- Part D — the discriminator
-- ---------------------------------------------------------------------------

-- Three values, and every value in the CHECK list carries its comma (gotcha #1).
ALTER TABLE public.escritos_templates
  ADD COLUMN tipo TEXT NOT NULL DEFAULT 'escrito'
    CHECK (tipo IN ('escrito','fragmento','demanda'));

-- Every existing row is a library escrito; the default already says so, this is
-- only here to make the intent explicit for anyone reading the migration.
COMMENT ON COLUMN public.escritos_templates.tipo IS
  'escrito = library document (the only kind ranked or offered); fragmento = a piece composed into another document; demanda = the case-opening document, reachable only from Iniciar demanda.';

CREATE INDEX idx_escritos_templates_tipo
  ON public.escritos_templates(tipo) WHERE archived_at IS NULL;


-- ---------------------------------------------------------------------------
-- Part D — medida cautelar fragments
-- ---------------------------------------------------------------------------
--
-- Selected by resolveCautelar():
--   every party works -> haberes      no party works -> mercadopago
--   otherwise         -> mixto
--
-- Scope handed to the engine (lib/domain/cautelar.ts cautelarScope):
--   PLURAL, ALGUNO_TRABAJA, VARIOS_TRABAJAN, HAY_CODEMANDADOS
--   PARTES[] = { NOMBRE, DNI, CUIL, DOMICILIO, ROL, TRABAJA,
--                EMPLEADOR, EMPLEADOR_CUIT, EMPLEADOR_DOMICILIO }

INSERT INTO public.escritos_templates
  (clave, tipo, titulo, categoria, orden, contenido)
VALUES

-- Corrections against "1. Ambos con Embargo de Sueldo" and the standalone model:
--   * the plural branch says "haciéndoseles saber" (the source keeps the
--     singular pronoun in an otherwise plural paragraph);
--   * "con domicilio real en" — the source reads "en en calle";
--   * the Subsidiariamente sentence is appended, which the haberes models omit
--     (Fran, 2026-08-18: that omission is being corrected).
('cautelar.haberes', 'fragmento', 'Cautelar — embargo de haberes', 'Fragmentos', 101,
$esc$VII.- MEDIDA CAUTELAR: SE TRABE EMBARGO.-

Que a los fines de garantizar el crédito reclamado por mi mandante, solicito se {{#if PLURAL}}decreten embargos sobre los haberes que los demandados perciben como empleados{{else}}decrete embargo sobre los haberes que el demandado percibe como empleado{{/if}}. A tal fin se denuncian sus correspondientes datos:

{{#each PARTES}}
{{NOMBRE}}, D.N.I. Nº {{DNI}}, C.U.I.L. N° {{CUIL}}, con domicilio real en {{DOMICILIO}}, y trabaja para {{EMPLEADOR}} (C.U.I.T. {{EMPLEADOR_CUIT}}) con domicilio en {{EMPLEADOR_DOMICILIO}}.-
{{/each}}

A los fines de efectivizar la medida requerida, y que mensualmente se efectúen las retenciones en el porcentaje de ley hasta cubrir la suma reclamada en estos actuados con más la que V.S. presupueste "prima facie" para responder a intereses, costos y costas de la presente ejecución, solicito se {{#if PLURAL}}libren cédulas oficios de estilo, con habilitación de días y horas inhábiles a los lugares de trabajo denunciados, haciéndoseles{{else}}libre cédula oficio de estilo, con habilitación de días y horas inhábiles al lugar de trabajo denunciado, haciéndosele{{/if}} saber que los importes deberán ser depositados a la orden de V.S. y como perteneciente a estos autos, en el Banco de la Provincia de Bs. As. - Suc. Tribunales de esta ciudad, todo ello bajo apercibimiento de ley.-

Subsidiariamente, y en caso de negativa de fondos y/o cuentas, solicito se trabe inhibición general de bienes.-

A dicho fin solicito se libre oficio electrónico al Banco Provincia Suc. Tribunales a fin de proceder a la apertura de una cuenta judicial a nombre de autos.-$esc$),

-- Built from "2. Ambos con Embargo de Mercado Pago", NOT from the standalone
-- Mercado Pago model: that one asks for a cédula to the employer of a person who
-- does not work (Fran confirmed the defect). Nobody here works, so no employer
-- paragraph appears at all.
('cautelar.mercadopago', 'fragmento', 'Cautelar — embargo de billetera virtual', 'Fragmentos', 102,
$esc$VII.- MEDIDA CAUTELAR: SE TRABE EMBARGO DE BILLETERA VIRTUAL MERCADO PAGO.-

Que a los fines de garantizar el crédito reclamado por mi mandante, solicito se {{#if PLURAL}}traben embargos sobre las cuentas personales de “Mercado Pago” a nombre de los demandados{{else}}trabe embargo sobre la cuenta personal de “Mercado Pago” a nombre del demandado{{/if}}. A tal fin se denuncian sus correspondientes datos:

{{#each PARTES}}
{{NOMBRE}}, D.N.I. Nº {{DNI}}, CUIT/CUIL {{CUIL}}, con domicilio en {{DOMICILIO}}.-
{{/each}}

Subsidiariamente, y en caso de negativa de fondos y/o cuentas, solicito se trabe inhibición general de bienes.-

A dicho fin solicito se libre oficio electrónico al Banco Provincia Suc. Tribunales a fin de proceder a la apertura de una cuenta judicial a nombre de autos.-$esc$),

-- Built from "4. D: Sueldo / CD: Mercado Pago", generalised to any number of
-- parties in any mix. The source leaves the retenciones text as an editorial
-- placeholder ("[insertar texto de retenciones del modelo 4]"); it is spelled
-- out here, once, after the clauses — repeating it per working party would say
-- the same thing twice in a filed document. The heading names both medidas, so
-- it always matches the body (the SAN MARTIN demanda's does not — gotcha #35).
('cautelar.mixto', 'fragmento', 'Cautelar — embargo mixto', 'Fragmentos', 103,
$esc$VII.- MEDIDA CAUTELAR: SE TRABE EMBARGO Y EMBARGO DE BILLETERA VIRTUAL.-

Que a los fines de garantizar el crédito reclamado por mi mandante, solicito:

{{#each PARTES}}
{{#if TRABAJA}}
Se decrete embargo sobre los haberes que el {{ROL}} {{NOMBRE}}, D.N.I. Nº {{DNI}}, C.U.I.L. N° {{CUIL}}, con domicilio real en {{DOMICILIO}}, percibe como empleado de {{EMPLEADOR}} (C.U.I.T. {{EMPLEADOR_CUIT}}) con domicilio en {{EMPLEADOR_DOMICILIO}}.-
{{else}}
Se trabe embargo sobre la cuenta personal de “Mercado Pago” a nombre del {{ROL}} {{NOMBRE}}, D.N.I. Nº {{DNI}}, CUIT/CUIL {{CUIL}}, con domicilio en {{DOMICILIO}}.-
{{/if}}
{{/each}}

{{#if ALGUNO_TRABAJA}}
A los fines de efectivizar el embargo de haberes requerido, y que mensualmente se efectúen las retenciones en el porcentaje de ley hasta cubrir la suma reclamada en estos actuados con más la que V.S. presupueste "prima facie" para responder a intereses, costos y costas de la presente ejecución, solicito se {{#if VARIOS_TRABAJAN}}libren cédulas oficios de estilo, con habilitación de días y horas inhábiles a los lugares de trabajo denunciados, haciéndoseles{{else}}libre cédula oficio de estilo, con habilitación de días y horas inhábiles al lugar de trabajo denunciado, haciéndosele{{/if}} saber que los importes deberán ser depositados a la orden de V.S. y como perteneciente a estos autos, en el Banco de la Provincia de Bs. As. - Suc. Tribunales de esta ciudad, todo ello bajo apercibimiento de ley.-
{{/if}}

Subsidiariamente, y en caso de negativa de fondos y/o cuentas, solicito se trabe inhibición general de bienes.-

A dicho fin solicito se libre oficio electrónico al Banco Provincia Suc. Tribunales a fin de proceder a la apertura de una cuenta judicial a nombre de autos.-$esc$);


-- ---------------------------------------------------------------------------
-- Part E — the demanda
-- ---------------------------------------------------------------------------
--
-- tipo = 'demanda' and both sugerido_* arrays empty: a demanda opens a case, so
-- recommending it against an ejecutado that already exists is nonsense. The
-- discriminator is what actually excludes it (rankEscritos drops any row whose
-- tipo is not 'escrito'); the empty arrays are belt and braces.
--
-- No expediente token anywhere, including inside {{ENCABEZADO}}: a demanda is
-- the document filed to OBTAIN a case number, so ejecutados.numero_expediente is
-- blank for every fresh one and threading it in would print a
-- [EXPEDIENTE] marker on all of them. escritos-actions.ts builds a demanda
-- variant of the encabezado that omits the "en autos caratulados … (Expt. N° …)"
-- clause, exactly as DEMANDA.docx does.
--
-- The fojas counts are physical facts about the paperwork (the two source
-- demandas carry 10 vs 12 fs. of resúmenes for otherwise identical
-- documentation), so they are MANUAL_INPUT_TOKENS and render as visible
-- [FOJAS_…] markers when left blank.

INSERT INTO public.escritos_templates
  (clave, tipo, titulo, categoria, orden, sugerido_movimiento, sugerido_medida_cautelar, sugerido_evento, sugerido_diligenciada, contenido)
VALUES
('demanda.cobro-ejecutivo', 'demanda', 'Demanda de cobro ejecutivo', 'Demanda', 201,
 '{}', '{}', '{}', NULL,
$esc$SUMARIO

ACTOR: {{EMPRESA}}
DEMANDADO: {{DEMANDADOS}}
MATERIA: COBRO EJECUTIVO. PREPARA VIA EJECUTIVA.-
MONTO: {{MONTO}}
DOCUMENTAL: 1.- Copia simple de poder general para juicios. 2.- Tasa de Justicia; Sobretasa; Bono ley 8480; Jus Previsional. 3.- Resúmenes de cuenta en número de {{FOJAS_RESUMENES}} fs. 4.- Declaración jurada sobre la inexistencia de denuncia fundada y válida, previa a la mora, por parte del titular por extravío o sustracción de la respectiva tarjeta de crédito, en 1 fs. 5.- Declaración jurada sobre la inexistencia de cuestionamiento fundado y válido, previo a la mora, por parte del titular, de conformidad con la legislación vigente, en 1 fs. 6.- Contrato de emisión de tarjeta de crédito original y Anexo, en {{FOJAS_CONTRATO}} fs. 7.- Acuse de recibo de la tarjeta de crédito, en {{FOJAS_ACUSE}} fs. 8.- Copia de nota al Ministerio de Economía y Finanzas Públicas de la Nación, Secretaría de Comercio, Subsecretaría de Comercio Interior, en 1 fs.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

PROMUEVE DEMANDA COBRO EJECUTIVO. PREPARA VIA EJECUTIVA. SOLICITA MEDIDA CAUTELAR.-

Sr/a Juez/a de Primera Instancia:

{{ENCABEZADO}}

I.- PERSONERIA.-

Que conforme lo acredito con la copia simple de poder general que junto con esta presentación acompaño, soy apoderado de la firma {{EMPRESA}} con domicilio legal en {{DOMICILIO_LEGAL_EMPRESA}}.- Declaro bajo juramento que el mandato invocado se encuentra vigente en toda su extensión y que la copia simple acompañada es fiel de su original, el que me comprometo a adjuntar ante el primer requerimiento de VS en tal sentido.-

II.- OBJETO.-

En el carácter invocado y siguiendo expresas instrucciones de mi mandante, vengo por el presente a promover formal demanda de ejecución contra {{DEMANDADOS}}, con domicilio real en {{DOMICILIO}}, por la suma de {{MONTO_LETRAS}} en concepto de saldo adeudado por la utilización en calidad de titular{{#if HAY_CODEMANDADOS}} y adicional respectivamente{{/if}}, de la tarjeta de crédito CLIPER, identificadas bajo las cuentas nro. {{CUENTA_CLIPER}} (CLIPER) y {{TARJETA_CABAL}} (CLIPER CABAL) desde el día {{FECHA_MORA}}, correspondiente al último resumen emitido por la entidad; solicitando desde ya a V.S. que al momento de dictar sentencia, se condene a la parte demandada al íntegro pago del capital reclamado con más los pertinentes intereses compensatorios, financieros y punitorios pactados contractualmente, costos, gastos y costas del presente procedimiento ejecutivo, rubros a calcularse desde operada la mora y hasta el momento del efectivo e íntegro pago de lo adeudado.-

Previamente solicito, conforme lo prescripto por los arts. 523, 524, y cctes. del Código Procesal Civil y Comercial de la Provincia de Buenos Aires y art. 39 de la Ley 25.065, se cite a la ejecutada para que dentro del plazo de 5 días comparezca ante V.S. a efectuar el reconocimiento de las firmas insertas en el Contrato de Emisión de Tarjeta de Crédito, en los Recibos de Tarjeta y reconocer el resumen de cuenta emitido, bajo apercibimiento de lo dispuesto por el art. 524 del mismo código.-

Oportunamente, solicito se libre mandamiento de intimación de pago correspondiente.-

Todo en virtud de las consideraciones de hecho y fundamentos de derecho que a continuación se exponen.-

III.- ANTECEDENTES.-

Mi mandante es una persona jurídica que resulta ser Entidad Emisora del Sistema de Tarjetas de Crédito CLIPER.-

La ahora ejecutada suscribió en fecha {{FECHA_CONTRATO}} con mi mandante contrato de emisión de tarjeta de crédito CLIPER, cuenta nro. {{CUENTA_CLIPER}}, mediante el cual se {{#if HAY_CODEMANDADOS}}emitieron {{CANTIDAD_PARTES_LETRAS}} tarjetas plásticas CLIPER, una bajo el nro. de {{else}}emitió una tarjeta plástica CLIPER bajo el nro. de {{/if}}{{#each PARTES}}{{TARJETA_CABAL}} ({{NOMBRE}}){{SEP}}{{/each}}{{#if HAY_CODEMANDADOS}}, {{#if VARIOS_CODEMANDADOS}}como adicionales{{else}}como adicional{{/if}}{{/if}}.-

{{#if HAY_CODEMANDADOS}}
En virtud de la cláusula quinta del contrato {{#if VARIOS_CODEMANDADOS}}dichos usuarios adicionales resultan obligados{{else}}dicho usuario adicional resulta obligado{{/if}} en forma solidaria con el usuario titular y con los restantes usuarios adicionales como codeudores, lisos y llanos principales pagadores.-
{{/if}}

La ejecutada comenzó a utilizar los servicios de dichas tarjetas operando con normalidad hasta que no abonó el resumen de cuenta emitido por mi mandante que se acompaña cuyo vencimiento operaba el {{FECHA_MORA}}, incurriendo en mora de pleno derecho (arg. art. 886 CCC).-

Por lo tanto, habiendo sido infructuosas las tratativas extrajudiciales tendientes a obtener el cobro de lo adeudado, no queda otra alternativa a {{EMPRESA}} que concurrir a la justicia por esta vía, a fin de lograr satisfacer el derecho que asiste a mi mandante.-

IV.- PREPARACION DE LA VIA EJECUTIVA.-

Por lo expuesto se solicita de conformidad a lo establecido por el art. 39 de la ley 25.065 se ordene la preparación de la vía ejecutiva, solicitando a tal efecto se intime al accionado para que dentro del plazo de ley efectúe el reconocimiento de los instrumentos acompañados en este líbelo inicial.-

V.- PRUEBA.-

1.- Documental: Acompaño la siguiente documental que hace al derecho de mi mandante:

- Resúmenes de cuenta emitidos de conformidad con la totalidad de los requisitos de la legislación vigente.-
- Declaración jurada sobre la inexistencia de denuncia fundada y válida, previa a la mora, por parte del titular por extravío o sustracción de la respectiva tarjeta de crédito.-
- Declaración jurada sobre la inexistencia de cuestionamiento fundado y válido, previo a la mora, por parte del titular, de conformidad con la legislación vigente.-
- Contrato de emisión de tarjeta de crédito original y Anexo.-
- Constancia de recibo de la Tarjeta de crédito.-
- Copia de nota al Ministerio de Economía y Finanzas Públicas de la Nación, Secretaría de Comercio, Subsecretaría de Comercio Interior.-

2.- Pericial supletoria.-

Para el caso hipotético e improbable en que la ejecutada desconozca la firma que se le atribuye en la documentación que se acompaña, solicito se designe perito calígrafo de la lista oficial a los fines que mediante el cotejo de firmas indubitadas y/o proceder a realizar el cuerpo de escritura correspondiente; se expida sobre si las firmas que se le atribuyen pertenecen al patrimonio escriturario de la ejecutada.-

VI.- MANIFIESTA RESPECTO A LA DOCUMENTACION ACOMPAÑADA.-

Que siguiendo precisas instrucciones de mi mandante manifiesto que el Contrato de Emisión de Tarjeta de Crédito acompañado se encuentra legalmente instrumentado cumplimentando la totalidad de los requisitos legales previstos por los arts. 6, 7 y cctes. de la Ley 25.065.-

En razón que la citada ley no ha sido reglamentada, se acompaña copia de la nota del informe expedido por el Ministerio de Economía y Finanzas Públicas de la Nación, Secretaría de Comercio, Subsecretaría de Comercio Interior de fecha 23/07/2015, en la cual hace saber que como la Ley de Tarjeta de Crédito no se encuentra reglamentada no se implementó el registro y aprobación de contratos previsto por la misma. Razón por la cual cuando mi mandante presentó el contrato que se adjunta para su registro y aprobación le fue informada dicha circunstancia.-

En caso que V.S. lo considere necesario, como medida de mejor proveer, podrá oficiarse al Ministerio de Economía y Finanzas Públicas de la Nación, Secretaría de Comercio, Subsecretaría de Comercio Interior a fin que informe si ratifica el informe acompañado, si la Ley 25.065 ha sido reglamentada y si se encuentra en funcionamiento el Registro de Contratos previsto por dicha Ley.-

{{SECCION_CAUTELAR}}

VIII.- SE EXIMA DE PRESTAR CAUCION. SUBSIDIARIAMENTE PRESTA CAUCION JURATORIA EN ESTE ACTO.-

En relación a la contracautela, y atento que mi representada resulta ser una entidad comercial y crediticia de reconocida solvencia económica (art. 200 inc. 1 in fine del CPCC), dado que {{EMPRESA}} tiene amplia actuación en plaza; y merced a la normalidad con que ésta se desempeña y la importancia de la hacienda empresarial y crediticia que explota, -todo lo cual redunda en que se trata de persona de conocida responsabilidad económica- es que de conformidad a la norma mencionada precedentemente, solicito se exima a mi parte de prestar caución juratoria. No obstante ello, y para el supuesto en el que V.S. lo considerara oportuno, a los efectos de la contracautela exigida por el ritual, el suscripto en este acto presta suficiente caución juratoria en nombre de mi mandante a fin de garantizar debidamente la pretensión de la medida cautelar que se solicita.-

IX.- AUTORIZADOS.-

Quedan autorizados a realizar cualquier trámite relacionado con las presentes actuaciones {{AUTORIZADOS}} y/o quienes ellos designen.-

X.- DERECHO.-

Fundo el derecho que le asiste a mi mandante en lo normado por los arts. 518, 521, 529, sgtes. y concds. del C.P.C.; arts. 27, 28, 39, 40 cttes y sstes de la ley 25.065; Circulares del B.C.R.A., Doctrina y Jurisprudencia vigente.-

XI.- MANIFIESTA SOBRE COPIA PARA TRASLADO.-

Teniendo en cuenta que las copias para traslado son reservadas en Secretaría por el exiguo término de tres meses y que en dicho plazo no se podrá librar el mandamiento de intimación de pago y embargo en autos cuyas copias deben agregarse, ya que resulta materialmente imposible preparar la vía ejecutiva solicitada antes de dicho término; sumado a que en el plazo estipulado por la Acordada 3886 se acompañará copia digital del escrito de inicio y documentación adjuntada, por lo tanto la misma podrá ser consultada por cualquier interesado a través de la Mesa de Entrada Virtual o podrá compulsar los originales en Secretaría; a los fines de evitar acumular documentación innecesaria en Secretaría, como así también evitar un gasto innecesario a mi mandante a los fines de acompañar copias que serán desechadas vencidos los plazos que fija la Reglamentación del art. 120 del C.P.C.C., vengo a solicitar se tenga presente que las copias para traslado se adjuntarán oportunamente al mandamiento de intimación de pago y embargo que se librará en autos una vez preparada la vía.-

XII.- RECUSA SIN EXPRESIÓN DE CAUSA.-

Que siguiendo precisas instrucciones de mi mandante, conforme art. 14 C.P.C.C.B.A vengo por el presente a recusar sin expresión de causa al Dr. {{JUEZ}}, Juez titular del {{JUZGADO}} de la ciudad de {{JUZGADO_LOCALIDAD}}, Departamento Judicial de {{DEPARTAMENTO}}.-

XIII.- PETICIÓN.-

Por todo lo expuesto, de V.S. solicito:

1.- Se me tenga por presentado, parte y con domicilio procesal constituido.-
2.- Por cumplido con lo dispuesto por las leyes 8.480 y 10.268 y por integrada la tasa de justicia y sobre tasa correspondiente.-
3.- Se cite al ejecutado a reconocer la firma del documento individualizado, bajo apercibimiento de ley.-
4.- Oportunamente, se libre mandamiento de intimación de pago contra el accionado por las sumas reclamadas con más los que V.S. presupueste para responder a intereses, costos y costas de la presente demanda.-
5.- Se decrete la medida cautelar peticionada en el Punto VII, librándose la cédula de estilo.-
6.- Se tengan presentes las autorizaciones conferidas.-
7.- En el momento procesal oportuno, se dicte sentencia de trance y remate, mandando llevar adelante la ejecución contra la parte aquí demandada, condenándola al íntegro pago de la suma reclamada con más los intereses y costas de la ejecución.-

Proveer de conformidad,

SERA JUSTICIA.-$esc$);
