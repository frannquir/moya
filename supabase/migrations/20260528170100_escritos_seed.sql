-- Seed: the 24 escrito templates (global/system rows). Runs as the migration
-- owner, bypassing RLS. Contenido uses dollar-quoting to avoid quote escaping.

INSERT INTO public.escritos_templates
  (titulo, categoria, orden, sugerido_movimiento, sugerido_medida_cautelar, sugerido_evento, sugerido_diligenciada, contenido)
VALUES
-- 1
('Preparar vía ejecutiva + Medida cautelar', 'Inicio de trámite', 1,
 ARRAY['Inicio Causa'], '{}', '{}', NULL,
$esc$SE TENGA POR PREPARADA LA VIA. SE MANDE A LLEVAR ADELANTE LA EJECUCION. SE PROVEA MEDIDA CAUTELAR.-

Sr. Juez:

{{ENCABEZADO}}

I.- Que teniendo en cuenta el estado de autos, vengo a solicitar se tenga por preparada la vía ejecutiva y se mande a llevar adelante la ejecución. En consecuencia, solicito se libre mandamiento de estilo.-

II.- Asimismo, solicito se provea la medida cautelar peticionada en el apartado VII del escrito de inicio.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 2
('Sentencia de trance y remate', 'Sentencia y liquidación', 2,
 ARRAY['Pedir Sentencia'], '{}', ARRAY['mandamiento.diligenciado'], true,
$esc$SE DICTE SENTENCIA DE TRANCE Y REMATE.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

Que teniendo en cuenta las constancias de autos, vengo por el presente en legal tiempo y forma a solicitar se dicte sentencia de trance y remate.-

PROVEER DE CONFORMIDAD,

SERÁ JUSTICIA.-$esc$),
-- 3
('Suspensión de términos (acuerdo extrajudicial)', 'Otros trámites', 3,
 '{}', '{}', '{}', NULL,
$esc$MANIFIESTA. SOLICITA SUSPENSIÓN DE TÉRMINOS.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

Que vengo a manifestar que el ejecutado en autos se ha comunicado con el Estudio Jurídico proponiendo un plan de pago al que mi mandante ha accedido de manera extrajudicial.-

En consecuencia, vengo a solicitar se suspenda el trámite del presente proceso hasta tanto mi mandante denuncie el cumplimiento total de las sumas aquí reclamadas más sus accesorios, gastos y costas o bien se denuncie el pago parcial de la deuda y se solicite continuar con la tramitación de este expediente por el saldo insoluto que en su momento eventualmente se denunciará.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 4
('Expediente cancelado – Solicita archivo', 'Cobro y transferencias', 4,
 ARRAY['En Cobro'], '{}', ARRAY['pago.acreditado'], NULL,
$esc$MANIFIESTA. DENUNCIA ACUERDO DE HONORARIOS. SOLICITA SE ARCHIVE.-

Sr. Juez:

{{ENCABEZADO}}

Vengo por el presente en legal tiempo y forma a manifestar que el Sr. {{DEMANDADO}} canceló el monto de la demanda.-

Por otra parte, vengo a denunciar acuerdo de honorarios por el 10% del monto de la demanda y a manifestar que dichos honorarios fueron percibidos por quien suscribe. En consecuencia, acompaño comprobante de pago de aportes e ingresos brutos correspondientes.-

Por último, solicito a V.S, que sin más archive las presentes actuaciones.-

PROVEER DE CONFORMIDAD,

SERÁ JUSTICIA.-$esc$),
-- 5
('Cumple intimación – Caducidad', 'Otros trámites', 5,
 '{}', '{}', ARRAY['caducidad.intimada'], NULL,
$esc$CUMPLE INTIMACIÓN. SE TENGA POR PREPARADA LA VÍA.-

Sr. Juez:

{{ENCABEZADO}}

I.- Que teniendo en cuenta lo proveído en fecha {{FECHA_PROVIDENCIA}}, vengo a manifestar la intención de mi mandante de continuar el trámite del presente proceso hasta su finalización.-

II.- En consecuencia, teniendo en cuenta el estado de autos, vengo a solicitar se tenga por preparada la vía ejecutiva y se mande a llevar adelante la ejecución. En consecuencia, solicito se libre mandamiento de estilo.-

III.- Asimismo, solicito se provea la medida cautelar peticionada en el apartado VII del escrito de inicio.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 6
('Cambio de medida cautelar → IGB', 'Medidas cautelares', 6,
 ARRAY['Enviar Mandamiento','En Cobro'], ARRAY['embargo'], '{}', NULL,
$esc$SE MODIFIQUE MEDIDA CAUTELAR. SE DECRETE INHIBICIÓN GENERAL DE BIENES.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

Que vengo por el presente en legal tiempo y forma a informar que el ejecutado no trabaja más en el empleo denunciado en el escrito de inicio, y desconociendo si efectivamente se encuentra actualmente empleado, solicito se sustituya la medida cautelar ordenada y se decrete inhibición general de bienes contra el Sr. {{DEMANDADO}}, D.N.I. Nº {{DOCUMENTO}}, C.U.I.L. N° {{CUIL_DEMANDADO}}.-

PROVEER DE CONFORMIDAD,

SERÁ JUSTICIA.-$esc$),
-- 7
('IGB – Adjunta timbrado RPI', 'Medidas cautelares', 7,
 ARRAY['Enviar Mandamiento'], ARRAY['igb'], '{}', NULL,
$esc$ADJUNTA COMPROBANTE. SOLICITA SE LIBRE OFICIO.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

I.- Que vengo por el presente a acreditar el pago de la Tasa por Servicios Registrales, siendo los 18 dígitos del timbrado {{TIMBRADO_18_DIGITOS}} manifestando que el monto abonado corresponde a una tasa de carácter simple, en los términos de la ley 10.295.-

II.- Teniendo en cuenta lo manifestado solicito se libre oficio judicial oportunamente ordenado a los fines de anotar la INHIBICIÓN GENERAL DE BIENES del Sr. {{DEMANDADO}}, D.N.I. Nº {{DOCUMENTO}} con domicilio en {{DOMICILIO_EJECUTADO}}.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 8
('IGB diligenciada – Solicita notificación', 'Medidas cautelares', 8,
 ARRAY['Enviar Mandamiento'], ARRAY['igb'], ARRAY['oficio.diligenciado'], true,
$esc$ADJUNTA OFICIO DILIGENCIADO. SE NOTIFIQUE.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

I.- Vengo por el presente a adjuntar oficio debidamente diligenciado por ante el Registro Nacional de la Propiedad Automotor en virtud del cual se tomó razón de la anotación de Inhibición General de Bienes del demandado con fecha {{FECHA_DILIGENCIAMIENTO}}. Solicito de V.S. se agregue y se tenga presente.-

II.- Asimismo, solicito de V.S. ordene se notifique el mismo al demandado (conf. art. 198 del CPC).-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 9
('Solicita aprobación de liquidación', 'Sentencia y liquidación', 9,
 ARRAY['Pedir Sentencia','En Cobro'], '{}', '{}', NULL,
$esc$SE TENGA POR APROBADA LA LIQUIDACIÓN.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

Que teniendo en cuenta el estado de autos, y atento al tiempo transcurrido vengo por el presente en legal tiempo y forma a solicitar se tenga por aprobada la liquidación practicada.-

Asimismo solicito de V.S. se regulen honorarios por mis actuaciones en autos.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 10
('Consiente honorarios – Solicita transferencia', 'Cobro y transferencias', 10,
 ARRAY['En Cobro'], ARRAY['embargo'], '{}', NULL,
$esc$CONSIENTE HONORARIOS. SOLICITA AMPLIACIÓN. SALDO DE CUENTA. SE ORDENE TRANSFERENCIA.-

Sr. Juez:

{{ENCABEZADO}}

I.- CONSIENTE HONORARIOS.-

Que vengo a consentir los honorarios regulados a quien suscribe en el proveído de fecha {{FECHA_PROVIDENCIA}}.-

II.- SOLICITA SALDO. SE ORDENE TRANSFERENCIA.-

Teniendo en cuenta el estado de autos, solicito se libre oficio al Banco Provincia a fin que informe el saldo de la cuenta abierta a nombre del expediente.-

En consecuencia, solicito se ordene transferir el saldo de la cuenta abierta a nombre de autos a la {{CUENTA_HONORARIOS}}; a cuenta de los honorarios regulados a quien suscribe, aportes e IVA.-

III.- SE AMPLÍE EMBARGO.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 11
('Solicita transferencia a cuenta de liquidación', 'Cobro y transferencias', 11,
 ARRAY['En Cobro'], '{}', '{}', NULL,
$esc$SOLICITA TRANSFERENCIA A CUENTA DE LA LIQUIDACIÓN APROBADA. ADJUNTA BOLETA DE APORTES. SOLICITA SE LIBRE OFICIO AL BANCO PROVINCIA.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

I.- Que teniendo en cuenta el saldo de cuenta informado y la transferencia de mis honorarios ordenada en fecha {{FECHA_PROVIDENCIA}} vengo por el presente en legal tiempo y forma a solicitar la transferencia de las sumas restantes {{MONTO_TRANSFERENCIA}} a cuenta de la liquidación aprobada, a tales fines se denuncian los siguientes datos:

{{BANCO}}; Sucursal {{SUCURSAL}}; N° {{NUMERO_CUENTA}}; CBU {{CBU}}, de titularidad de {{EMPRESA}} C.U.I.T. {{CUIT_EMPRESA}}.-

II.- Asimismo, vengo por el presente a adjuntar la boleta de aportes correspondientes a los honorarios de quien suscribe. Por lo expuesto solicito se libre oficio electrónico al Banco Provincia a fin de hacer efectiva la transferencia.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 12
('Practica liquidación', 'Sentencia y liquidación', 12,
 ARRAY['Pedir Sentencia'], '{}', ARRAY['sentencia.dictada'], NULL,
$esc$PRACTICA LIQUIDACIÓN. SE DÉ TRASLADO POR NOTA.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

I.- Que teniendo en cuenta el estado de autos, vengo por el presente a practicar liquidación de la sentencia dictada el {{FECHA_SENTENCIA}}.-

• Capital: {{CAPITAL}}
• Mora: {{FECHA_MORA}}
• Intereses compensatorios: {{INTERESES_COMPENSATORIOS}}
• Intereses punitorios: {{INTERESES_PUNITORIOS}}
• IVA s/ intereses: {{IVA_INTERESES}}
• Tasa y contribución: {{TASA_CONTRIBUCION}}
{{GASTOS_LINEA}}

TOTAL: {{TOTAL_LIQUIDACION}}

Acompaño planilla de cálculo de los intereses.-

La presente liquidación asciende a la suma de {{TOTAL_LETRAS}} ({{TOTAL_LIQUIDACION}}).-

II.- Teniendo en cuenta el estado de autos, solicito se corra traslado a la ejecutada por ministerio de ley.-

III.- Oportunamente, solicito se tenga por aprobada la liquidación practicada.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 13
('Solicita autorización movimientos bancarios', 'Otros trámites', 13,
 ARRAY['En Cobro'], '{}', '{}', NULL,
$esc$SOLICITA AUTORIZACIÓN PARA VER MOVIMIENTOS BANCARIOS.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

Que teniendo en cuenta el estado de autos, y al constatar la imposibilidad de visualizar los movimientos de la cuenta judicial abierta a nombre de autos en el portal de notificaciones y presentaciones electrónicas, vengo por el presente a solicitar de V.S. ordene la autorización. Adjunto captura de pantalla.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 14
('Sustitución medida cautelar – MercadoPago', 'Medidas cautelares', 14,
 ARRAY['En Cobro'], ARRAY['embargo'], '{}', NULL,
$esc$SOLICITA SUSTITUCIÓN MEDIDA CAUTELAR.-

Sr. Juez:

{{ENCABEZADO}}

I. Que habiendo tomado conocimiento de que el ejecutado goza con la titularidad en la billetera virtual Mercado Pago vengo por el presente a solicitar de V.S, se ordene embargo de todo tipo de cuenta, caja de ahorro, cuenta corriente y/o plazos fijo que el ejecutado posea en dicha entidad.-

II. Dicho ello solicito de V.S., se ordene librar el oficio correspondiente a dicha entidad.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 15
('Solicita nueva cédula', 'Cédulas y notificaciones', 15,
 ARRAY['Enviar Cédula'], '{}', ARRAY['cedula.revocada'], false,
$esc$MANIFIESTA. SOLICITA NUEVA CÉDULA.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

I.- Teniendo en cuenta el estado procesal de éstos autos, vengo por el presente a manifestar que es intención de mi mandante proseguir con el trámite de los mismos hasta su culminación.

II.- Solicito de V.S., se ordene librar una nueva cédula al domicilio informado por RENAPER, BAJO RESPONSABILIDAD DE PARTE actora.-

Proveer de conformidad,

SERÁ JUSTICIA.-$esc$),
-- 16
('Cumple intimación – Denuncia nuevo domicilio', 'Cédulas y notificaciones', 16,
 ARRAY['Enviar Cédula'], '{}', ARRAY['cedula.revocada'], false,
$esc$CUMPLE INTIMACIÓN. DENUNCIA DOMICILIO. SOLICITA NUEVA CÉDULA.-

Sr. Juez:

{{ENCABEZADO}}

I.- Que teniendo en cuenta lo proveído en fecha {{FECHA_PROVIDENCIA}}, vengo a manifestar la intención de mi mandante de continuar el trámite del presente proceso hasta su finalización.-

II.- En consecuencia, teniendo en cuenta el estado de autos, vengo a denunciar nuevo domicilio del ejecutado sito en {{NUEVO_DOMICILIO}}.-

III.- Por lo expuesto solicito se libre nueva cédula al nuevo domicilio del ejecutado.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 17
('Cumple intimación – Domicilio laboral', 'Cédulas y notificaciones', 17,
 ARRAY['Enviar Cédula'], '{}', ARRAY['cedula.revocada'], false,
$esc$CUMPLE INTIMACIÓN. DENUNCIA DOMICILIO LABORAL. SOLICITA NUEVA CÉDULA.-

Sr. Juez:

{{ENCABEZADO}}

I.- Que teniendo en cuenta lo proveído en fecha {{FECHA_PROVIDENCIA}}, vengo a manifestar la intención de mi mandante de continuar el trámite del presente proceso hasta su finalización.-

II.- Luego de una exhaustiva búsqueda hemos ubicado el domicilio laboral del ejecutado sito en {{DOMICILIO_LABORAL}}. En consecuencia, solicito se libre nueva cédula a los mismos fines y efectos que la anterior al domicilio laboral del ejecutado.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 18
('Solicita saldo de cuenta', 'Cobro y transferencias', 18,
 ARRAY['En Cobro'], ARRAY['embargo'], '{}', NULL,
$esc$SOLICITA SE INFORME SALDO DE CUENTA.-

Sr. Juez:

{{ENCABEZADO}}

Que vengo por el presente a solicitar de V.S, se ordene librar comunicación electrónica al Banco Provincia de Buenos Aires al sólo efecto de que se informe el saldo de la cuenta judicial abierta a nombre de autos.

Proveer de conformidad,

Será Justicia.-$esc$),
-- 19
('Solicita desparalización', 'Otros trámites', 19,
 '{}', '{}', '{}', NULL,
$esc$SOLICITA DESPARALIZACIÓN.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

Que atento el estado de autos, vengo por el presente a solicitar de V.S, se ordene la desparalización de estas actuaciones.

Proveer de conformidad,

Será Justicia.-$esc$),
-- 20
('Solicita oficio RENAPER', 'Cédulas y notificaciones', 20,
 ARRAY['Enviar Cédula'], '{}', ARRAY['cedula.revocada'], false,
$esc$SOLICITAR SE LIBRE OFICIO.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

Que teniendo en cuenta el estado de autos, vengo por el presente a solicitar a V.S se libre oficio al RENAPER a fin de informar el último domicilio del ejecutado.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 21
('Solicita transferencia de honorarios', 'Cobro y transferencias', 21,
 ARRAY['En Cobro'], '{}', '{}', NULL,
$esc$SOLICITA TRANSFERENCIA EN CONCEPTO DE PAGO A CUENTA DE LOS HONORARIOS.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

Habida cuenta del estado de autos, vengo por el presente a solicitar de V.S se ordene la transferencia de {{MONTO_HONORARIOS}} en concepto de honorarios más la suma de {{MONTO_IVA}} en concepto de IVA más la suma de {{MONTO_APORTES}} en concepto de aportes.

TOTAL {{TOTAL_HONORARIOS}}.

Solicito se ordene transferir dicho monto a la {{CUENTA_HONORARIOS}}; a cuenta de los honorarios regulados a quien suscribe, aportes e IVA. Adjunto boleta de aportes correspondiente.

Proveer de conformidad,

Será Justicia.-$esc$),
-- 22
('Practica nueva liquidación + Oficio ampliatorio', 'Sentencia y liquidación', 22,
 ARRAY['En Cobro'], '{}', '{}', NULL,
$esc$PRACTICA NUEVA LIQUIDACIÓN. OPORTUNAMENTE SE APRUEBE. SOLICITA OFICIO AMPLIATORIO.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

I.- Teniendo en cuenta el estado de autos, vengo a practicar liquidación por los intereses desde la practicada anteriormente en fecha {{FECHA_LIQUIDACION_ANTERIOR}} hasta el día de la fecha ({{FECHA_HOY}}) teniendo en cuenta el capital impago de {{CAPITAL_IMPAGO}}.-

• Intereses Compensatorios: {{INTERESES_COMPENSATORIOS}}
• Intereses Punitorios: {{INTERESES_PUNITORIOS}}
• IVA s/ intereses: {{IVA_INTERESES}}
• Intereses tasa BIP desde el pago {{FECHA_PAGO}} al {{FECHA_HOY}}: {{INTERESES_TASA_BIP}}

TOTAL: {{TOTAL_NUEVA_LIQUIDACION}}

Acompaño planilla de cálculo de los intereses.-

En consecuencia, se encuentra pendiente de pago la suma de {{TOTAL_PENDIENTE}} comprensiva de los siguientes conceptos: respecto a la liquidación aprobada en autos el {{FECHA_LIQUIDACION_ANTERIOR}} por la suma de {{MONTO_LIQUIDACION_ANTERIOR}}, más la actual liquidación presentada precedentemente.-

II.- SOLICITA SE LIBRE OFICIO AMPLIATORIO

Solicito se libre oficio ampliatorio a fin de cubrir el saldo pendiente de honorarios, y de la liquidación aprobada oportunamente.

PROVEER DE CONFORMIDAD,

SERÁ JUSTICIA.-$esc$),
-- 23
('Solicita devolución al juzgado de origen', 'Otros trámites', 23,
 '{}', '{}', '{}', NULL,
$esc$SOLICITA DEVOLUCIÓN.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

Teniendo en cuenta el estado de autos, vengo por el presente a solicitar de V.S se ordene la devolución de las presentes actuaciones al juzgado de origen a fin de proseguir con el trámite judicial.-

Proveer de conformidad,

Será Justicia.-$esc$),
-- 24
('Desparalización + Embargo MercadoPago', 'Medidas cautelares', 24,
 ARRAY['En Cobro'], '{}', '{}', NULL,
$esc$SOLICITA DESPARALIZACIÓN - SOLICITA REEMPLAZO DE MEDIDA CAUTELAR EMBARGO BILLETERA VIRTUAL.-

Sr/a Juez/a de Primera Instancia:

{{ENCABEZADO}}

I. Que atento el estado de autos, vengo por el presente a solicitar de V.S, se ordene la desparalización de estas actuaciones.

II.- Que habiendo tomado conocimiento de que el ejecutado no trabaja en relación de dependencia y goza con la titularidad en la billetera virtual Mercado Pago vengo por el presente a solicitar de V.S, se ordene reemplazo de medida cautelar embargo de todo tipo de cuenta, caja de ahorro, cuenta corriente y/o plazos fijo que el ejecutado posea en dicha entidad.-

III. Dicho ello solicito de V.S., se ordene librar el oficio correspondiente a dicha entidad.-

Proveer de conformidad,

SERÁ JUSTICIA.-$esc$);
