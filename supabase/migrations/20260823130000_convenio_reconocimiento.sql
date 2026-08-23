-- Phase 3 — the Reconocimiento de Deuda.
--
-- clave convenio.reconocimiento-deuda, tipo 'escrito': it is a library document
-- the lawyer generates against an existing case, and the via-keyed pinned layer
-- (lib/domain/escritos-pinned.ts) puts it FIRST on an extrajudicial one.
--
-- Título is "Reconocimiento de Deuda", which is what Fran calls it; the full
-- formal name stays inside the body, as its first line.
--
-- All four of the firm's hand-kept convenio variants collapse into this single
-- row: {{CUOTAS_TEXTO}} carries the 1 / 3 / 6 / 12 difference, and the schedule
-- is derived by lib/domain/convenio.ts rather than typed per document.
--
--
-- Transcribed from CONVENIO DE RECONOCIMIENTO Y REFINANCIACIÓN DE DEUDA (1).docx
-- with its defects corrected rather than carried forward (gotcha #35). What the
-- source got wrong, and what this does instead:
--
--   * The caption reads "TARTAN S.A. C/ TARTAN S.A. C/ GARMENDIA PAMELA" — the
--     actor is duplicated — while the encabezado names CONTAR S.A. as acreedor.
--     Two different defects in one sentence. Here the caption is built from the
--     same {{EMPRESA}} that appears as EL ACREEDOR, so it cannot disagree with
--     itself, and there is exactly one actor.
--   * The deposit account is described as "de titularidad de Tartan S.A" on a
--     convenio whose acreedor is Contar. Same fix: {{EMPRESA}} / {{CUIT_EMPRESA}}.
--   * "el Sra. Garmendia Pamela" — the app holds no gender for a demandado, so
--     the treatment is dropped rather than guessed at.
--   * "Expte. N° 52310de trámite" (missing space), "Dichas suma debera",
--     "EL DEUDOR asumen", "expediénte", "quién reconoce" (relative pronoun, no
--     accent), and the unaccented SEPTIMA / DECIMA headings.
--   * The honorarios sentence ends mid-phrase — "de titularidad del Dr. Rubén
--     Adrián" — because the account description was pasted in short. The whole
--     description now comes from {{CUENTA_HONORARIOS}}.
--   * "PESOS TRECIENTOS CINCO MIL" — numeroALetras spells TRESCIENTOS.
--
-- The honorarios figure is 5 JUS in the source. The firm's regulated types are
-- 3.5 and 7 (locked by the honorarios model), so {{HONORARIOS_JUS}} resolves from
-- the case's own honorario row and {{HONORARIOS_TOTAL_LETRAS}} from
-- lib/domain/honorarios.ts — grossCapJus, the ×1.31 the client signed off. The
-- tax math is not recomputed here or anywhere in the render path.
--
-- No business-day calendar: clause SEGUNDA's own "si la fecha de vencimiento
-- convenida correspondiere a día inhábil o feriado…" already covers it in prose.
--
-- No client data ships in a migration — every name, CUIL, amount and account is
-- a token.

INSERT INTO public.escritos_templates
  (clave, tipo, titulo, categoria, orden, sugerido_movimiento, sugerido_medida_cautelar, sugerido_evento, sugerido_diligenciada, contenido)
VALUES
('convenio.reconocimiento-deuda', 'escrito', 'Reconocimiento de Deuda', 'Convenio', 301,
 '{}', '{}', '{}', NULL,
$esc$CONVENIO DE RECONOCIMIENTO Y REFINANCIACIÓN DE DEUDA.-

Entre {{ABOGADO_NOMBRE}}, D.N.I. N° {{ABOGADO_DNI}}, con domicilio en la {{DOMICILIO_PROCESAL}}, en su carácter de letrado apoderado de {{EMPRESA}}, tal como se acredita con copia simple del poder general para asuntos judiciales adjuntado, en adelante denominado EL ACREEDOR; y {{DEMANDADO}}, D.N.I. N° {{DNI_DEMANDADO}}, con domicilio en {{DOMICILIO}}, por derecho propio, en adelante denominado EL DEUDOR; en autos caratulados "{{EMPRESA}} C/ {{DEMANDADO_MAYUSCULA}} S/ COBRO EJECUTIVO", Expte. N° {{EXPEDIENTE}}, de trámite ante el {{JUZGADO}}, convienen celebrar el presente convenio de reconocimiento y refinanciación de deuda de acuerdo a las siguientes cláusulas:

PRIMERA: EL DEUDOR reconoce y asume la deuda que mantiene con EL ACREEDOR con motivo de los resúmenes de tarjeta de fecha {{FECHA_MORA}} adeudados en virtud del Contrato de Emisión de Tarjeta de Crédito Cliper celebrado, por el cual se emitió una tarjeta de crédito.-

La deuda por el presente reconocida a la fecha asciende a la suma de {{MONTO_LETRAS}}, en adelante denominada la DEUDA RECONOCIDA.-

SEGUNDA: La DEUDA RECONOCIDA será abonada por EL DEUDOR de la siguiente forma, en adelante denominada DEUDA REFINANCIADA: en {{CUOTAS_TEXTO}}. Con vencimiento la primera el {{FECHA_VENCIMIENTO}}.-
{{#if HAY_CUOTAS}}

El detalle de los vencimientos convenidos es el siguiente:
{{#each PLAN_PAGOS}}Cuota {{NRO}}: {{MONTO}}, con vencimiento el {{FECHA}}.-
{{/each}}
{{/if}}

Si la fecha de vencimiento convenida correspondiere a día inhábil o feriado, el pago deberá efectuarse el día hábil posterior.-

Dichas sumas deberán ser depositadas o transferidas, en las fechas convenidas, en la siguiente cuenta: {{CUENTA_ACREEDOR}}, de titularidad de {{EMPRESA}} (C.U.I.T. {{CUIT_EMPRESA}}).- El comprobante de depósito o transferencia en la cuenta indicada deberá ser enviado al mail {{ABOGADO_EMAIL}} o al teléfono {{ABOGADO_TELEFONO}} vía WhatsApp.-

TERCERA: Las partes acuerdan que las costas son a cargo de EL DEUDOR.-

Se pactan los honorarios de {{ABOGADO_NOMBRE}} en la suma de {{HONORARIOS_JUS}} JUS, más aportes de ley e IVA, ascendiendo a la suma total de {{HONORARIOS_TOTAL_LETRAS}}. Dicha suma será abonada por EL DEUDOR el {{FECHA_VENCIMIENTO}}.-

Si la fecha de vencimiento convenida correspondiere a día inhábil o feriado, el pago deberá efectuarse el día hábil posterior.-

Dicha suma deberá ser depositada o transferida, en la fecha convenida, en la siguiente cuenta: {{CUENTA_HONORARIOS}}.-

Asimismo, EL DEUDOR asume el pago de la diferencia de tasa de justicia y su correspondiente contribución a fin de homologar el presente convenio judicialmente.-

CUARTA: Bajo ningún modo puede considerarse al presente como novación de deuda en los términos de los arts. 933/941 del Código Civil y Comercial, los que no son aplicables en este caso para EL DEUDOR, quien reconoce expresamente la deuda referida por la CLÁUSULA PRIMERA del presente convenio. Se mantienen subsistentes y con plena validez e idéntica extensión las obligaciones y garantías que asumió y constituyó en respaldo de los créditos y/u obligaciones citadas en la CLÁUSULA PRIMERA del presente.-

QUINTA: Las partes acuerdan que EL DEUDOR incurrirá en mora de pleno derecho, sin necesidad de interpelación judicial o extrajudicial, en las siguientes circunstancias: a) no realizar los pagos de las cuotas en las fechas y en la forma convenidas en el presente; b) si EL DEUDOR pidiese su propia quiebra o lo hiciere un tercero y no fuera rechazada dicha solicitud por el tribunal interviniente en la primera oportunidad procesal que corresponda; o si EL DEUDOR promoviere concurso preventivo o acuerdo extrajudicial con los acreedores; o incurriere en cesación de pagos aún sin efectuar los trámites antedichos; o trabare alguna medida cautelar sobre sus bienes que, por su magnitud, comprometa la responsabilidad patrimonial de EL DEUDOR; c) incumplimiento de cualquiera de las obligaciones asumidas en el presente contrato; d) falta de pago de cualquier otra obligación contraída por EL DEUDOR con EL ACREEDOR; e) rechazo de un cheque firmado por EL DEUDOR, por falta de fondos; f) cierre, por causas imputadas al DEUDOR, de la cuenta corriente que posea o abriese en el futuro; g) fallecimiento del DEUDOR; h) cualquier modificación dolosa, culposa o casual de la situación patrimonial de EL DEUDOR que, evaluada con criterios objetivos de apreciación de riesgo crediticio, ponga en peligro la percepción de la DEUDA REFINANCIADA; i) cualquier alteración que, a criterio de EL ACREEDOR, ocasione un cambio fundamental en las condiciones básicas que se han tenido en cuenta para suscribir el presente convenio.-

En caso de operar cualquiera de las circunstancias precedentemente enunciadas, caducarán de pleno derecho la totalidad de los plazos otorgados, haciéndose exigible inmediatamente el pago de la totalidad de la deuda, que se considerará totalmente vencida, con más sus intereses compensatorios y punitorios, quedando facultado EL ACREEDOR a demandar judicialmente por vía ejecutiva el cumplimiento del presente convenio.-

SEXTA: En caso de incumplimiento de cualquiera de las cuotas se estipula un interés moratorio equivalente a la tasa activa del Banco de la Provincia de Buenos Aires y un interés punitorio equivalente al 50% de la tasa activa del Banco de la Provincia de Buenos Aires, que se adicionará al interés moratorio.-

SÉPTIMA: EL DEUDOR renuncia expresamente a invocar, en caso de litigio, las prescripciones contenidas en los artículos 1091 y 332 del Código Civil y Comercial, que reglamentan la teoría de la imprevisión y la lesión subjetiva respectivamente, ya que en este acto reconoce actuar con plena capacidad para obligarse y conocer perfectamente las variaciones que se producen en los mercados cambiarios, económicos y financieros.-

OCTAVA: Una vez abonados los montos de capital, honorarios y aportes, el estudio se compromete a solicitar el archivo del expediente, entregar el libre de deuda y levantar las medidas cautelares que se pudieran haber solicitado.-

NOVENA: El sellado de este contrato y cualquier otro gasto emergente del mismo quedan a cargo exclusivamente de EL DEUDOR, quien por el presente autoriza a sumarlos al capital de la DEUDA REFINANCIADA.-

DÉCIMA: Para el caso de que surja conflicto de algún tipo en la interpretación o el cumplimiento del presente convenio y a los efectos legales, las partes acuerdan la jurisdicción y competencia de los Juzgados Civiles y Comerciales Ordinarios del Departamento Judicial de {{DEPARTAMENTO}}, renunciando a cualquier otro fuero o jurisdicción que pudiere corresponder.-

DÉCIMA PRIMERA: A todos los efectos legales, las partes constituyen domicilio especial en los arriba indicados, donde serán válidas todas las notificaciones judiciales o extrajudiciales que en virtud del presente convenio se cursen.-

DÉCIMA SEGUNDA: En prueba de conformidad se firman dos ejemplares a un solo efecto en la ciudad de {{DEPARTAMENTO}}, {{FECHA_FIRMA_LETRAS}}.-$esc$);

DO $$
DECLARE
  cuerpo TEXT;
BEGIN
  SELECT contenido INTO cuerpo
    FROM public.escritos_templates
   WHERE clave = 'convenio.reconocimiento-deuda';

  IF cuerpo IS NULL THEN
    RAISE EXCEPTION 'convenio template was not inserted';
  END IF;

  -- The three tokens that carry the whole point of the phase. A body that lost
  -- one of them to a copy-paste would still generate, silently, without the
  -- settlement in it.
  IF cuerpo NOT LIKE '%{{CUOTAS_TEXTO}}%'
     OR cuerpo NOT LIKE '%{{MONTO_LETRAS}}%'
     OR cuerpo NOT LIKE '%{{#each PLAN_PAGOS}}%' THEN
    RAISE EXCEPTION 'convenio body is missing one of CUOTAS_TEXTO / MONTO_LETRAS / PLAN_PAGOS';
  END IF;

  RAISE NOTICE 'convenio.reconocimiento-deuda seeded (% chars)', length(cuerpo);
END $$;
