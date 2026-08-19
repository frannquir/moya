-- "Practica liquidación": the bullet list gains the manual interés on gastos.
--
-- Two changes to the concept list:
--   - the conditional {{GASTOS_LINEA}} becomes a plain "• Gastos: {{GASTOS}}"
--     line, so gastos are stated even when zero (matching how the liquidación
--     PDF prints GASTOS $0,00 rather than omitting the row);
--   - "Tasa y contribución" is replaced by "Intereses sobre tasa y contribución",
--     which IS the new manual interés — {{INTERES_GASTOS}}.
--
-- Targeted by clave, not by title.

UPDATE public.escritos_templates
SET contenido = $esc$PRACTICA LIQUIDACIÓN. SE DÉ TRASLADO POR NOTA.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

I.- Que teniendo en cuenta el estado de autos, vengo por el presente a practicar liquidación de la sentencia dictada el {{FECHA_SENTENCIA}}.-

• Capital: {{CAPITAL}}
• Mora: {{FECHA_MORA}}
• Intereses compensatorios: {{INTERESES_COMPENSATORIOS}}
• Intereses punitorios: {{INTERESES_PUNITORIOS}}
• IVA s/ intereses: {{IVA_INTERESES}}
• Gastos: {{GASTOS}}
• Intereses sobre tasa y contribución: {{INTERES_GASTOS}}

TOTAL: {{TOTAL_LIQUIDACION}}

Acompaño planilla de cálculo de los intereses.-

La presente liquidación asciende a la suma de {{TOTAL_LETRAS}} ({{TOTAL_LIQUIDACION}}).-

II.- Teniendo en cuenta el estado de autos, solicito se corra traslado a la ejecutada por ministerio de ley.-

III.- Oportunamente, solicito se tenga por aprobada la liquidación practicada.-

Proveer de conformidad,

Será Justicia.-$esc$
WHERE clave = 'practica-liquidacion';
