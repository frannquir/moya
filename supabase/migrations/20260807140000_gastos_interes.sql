-- Gastos: a date and a manually-entered interés, both carried into the liquidación.
--
-- Gastos are money the lawyer fronted and must be reimbursed. They accrue interest
-- at rates that differ from the debt's, so the interés is typed in rather than
-- computed, and it adds to the liquidación total verbatim.
--
-- Both columns are NULL by default and never default to 0: NULL means "not
-- entered", which is a different thing from "entered as zero". The column names
-- match the old project's (cross-project convention, 2026-07-23) so the migration
-- script can map them straight across.

ALTER TABLE public.ejecutados
  ADD COLUMN fecha_gastos DATE,
  ADD COLUMN interes_gastos NUMERIC CHECK (interes_gastos >= 0);

ALTER TABLE public.liquidaciones
  ADD COLUMN interes_gastos NUMERIC;

-- The liquidación only ever stored total_intereses (compensatorios + punitorios
-- combined), which left {{INTERESES_COMPENSATORIOS}} / {{INTERESES_PUNITORIOS}}
-- unresolvable on a generated escrito. Snapshot the two halves as calculated
-- rather than deriving them from the total, so the escrito stays truthful if the
-- punitorios formula ever stops being "half the compensatorios".
-- NULL on existing rows; they get populated the next time the liquidación is
-- regenerated, and escritos-actions.ts falls back to the derivation until then.
ALTER TABLE public.liquidaciones
  ADD COLUMN total_compensatorios NUMERIC,
  ADD COLUMN total_punitorios NUMERIC;

COMMENT ON COLUMN public.ejecutados.interes_gastos IS
  'Manually entered interest accrued on gastos. NULL = not entered. Adds to the liquidacion total verbatim.';
COMMENT ON COLUMN public.liquidaciones.interes_gastos IS
  'Snapshot of ejecutados.interes_gastos at generation time.';
