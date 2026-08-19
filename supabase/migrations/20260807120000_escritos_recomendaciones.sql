-- Escritos: stable template keys, the two cédula variants, the new mandamiento
-- template, and the liquidación event tags that let a mail keyword surface both
-- liquidación escritos.
--
-- `clave` is a machine key for the templates the deterministic pinned-set layer
-- (lib/domain/escritos-pinned.ts) references. Titles are client-facing copy and
-- must never be what code matches on. Only the referenced rows get a clave;
-- the rest stay NULL (UNIQUE permits repeated NULLs in Postgres).

ALTER TABLE public.escritos_templates
  ADD COLUMN clave TEXT;

ALTER TABLE public.escritos_templates
  ADD CONSTRAINT escritos_templates_clave_key UNIQUE (clave);

UPDATE public.escritos_templates SET clave = 'preparar-via-cautelar'
  WHERE titulo = 'Preparar vía ejecutiva + Medida cautelar';
UPDATE public.escritos_templates SET clave = 'sentencia-trance-remate'
  WHERE titulo = 'Sentencia de trance y remate';
UPDATE public.escritos_templates SET clave = 'cumple-intimacion-caducidad'
  WHERE titulo = 'Cumple intimación – Caducidad';
UPDATE public.escritos_templates SET clave = 'solicita-aprobacion-liquidacion'
  WHERE titulo = 'Solicita aprobación de liquidación';
UPDATE public.escritos_templates SET clave = 'practica-liquidacion'
  WHERE titulo = 'Practica liquidación';
UPDATE public.escritos_templates SET clave = 'oficio-renaper'
  WHERE titulo = 'Solicita oficio RENAPER';
UPDATE public.escritos_templates SET clave = 'practica-nueva-liquidacion-oficio'
  WHERE titulo = 'Practica nueva liquidación + Oficio ampliatorio';


-- A mail carrying the liquidación keyword means the liquidación is actionable:
-- it may now be solicited, or it was just approved. Fran's decision (2026-07-22)
-- is to surface BOTH escritos together and let the lawyer pick. Both eventos are
-- tagged on both templates because EscritoSignalState carries only the single
-- latest confirmed evento — whichever of the two the lawyer confirms, the pair
-- still clears the threshold via WEIGHTS.evento.
UPDATE public.escritos_templates
  SET sugerido_evento = ARRAY['liquidacion.practicable','liquidacion.aprobada']
  WHERE clave IN ('solicita-aprobacion-liquidacion', 'practica-nueva-liquidacion-oficio');


-- The single "Solicita nueva cédula" is replaced by two explicit variants.
-- Soft-delete, never DELETE: generated escritos reference template_id.
UPDATE public.escritos_templates
  SET archived_at = now()
  WHERE titulo = 'Solicita nueva cédula'
    AND archived_at IS NULL;


INSERT INTO public.escritos_templates
  (clave, titulo, categoria, orden, sugerido_movimiento, sugerido_medida_cautelar, sugerido_evento, sugerido_diligenciada, contenido)
VALUES
('cedula-habilitacion',
 'Solicita nueva cédula - Habilitación días y horas inhábiles',
 'Cédulas y notificaciones', 25,
 ARRAY['Enviar Cédula'], '{}', ARRAY['cedula.revocada'], false,
$esc$SOLICITA NUEVA CÉDULA CON HABILITACIÓN DE DÍAS Y HORAS INHÁBILES.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

Solicito de V.S., se ordene librar una nueva cédula a los mismos efectos que la anterior, con habilitación de días y horas inhábiles.-

Proveer de conformidad,

SERÁ JUSTICIA.-$esc$),

('cedula-bajo-responsabilidad',
 'Solicita nueva cédula - Bajo responsabilidad parte actora',
 'Cédulas y notificaciones', 26,
 ARRAY['Enviar Cédula'], '{}', ARRAY['cedula.revocada'], false,
$esc$SOLICITA NUEVA CÉDULA BAJO RESPONSABILIDAD DE LA PARTE ACTORA.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

Solicito de V.S., se ordene librar una nueva cédula a los mismos efectos que la anterior, bajo responsabilidad de la parte actora.-

Proveer de conformidad,

SERÁ JUSTICIA.-$esc$),

('nuevo-mandamiento',
 'Solicita nuevo mandamiento',
 'Cédulas y notificaciones', 27,
 ARRAY['Enviar Mandamiento'], '{}', '{}', false,
$esc$SOLICITA NUEVO MANDAMIENTO CON HABILITACIÓN DE DÍAS Y HORAS INHÁBILES.-

Señor Juez de Primera Instancia:

{{ENCABEZADO}}

Solicito de V.S., se ordene librar un nuevo mandamiento a los mismos efectos que el anterior, con habilitación de días y horas inhábiles.-

Proveer de conformidad,

SERÁ JUSTICIA.-$esc$);
