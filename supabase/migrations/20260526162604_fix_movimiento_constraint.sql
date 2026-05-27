
-- typo, https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
ALTER TABLE public.ejecutados DROP CONSTRAINT IF EXISTS ejecutados_movimiento_check;

ALTER TABLE public.ejecutados ADD CONSTRAINT ejecutados_movimiento_check
  CHECK (movimiento IN (
    'Inicio Causa',
    'Enviar Cédula',
    'Enviar Mandamiento',
    'Pedir Sentencia',
    'En Cobro'
  ));