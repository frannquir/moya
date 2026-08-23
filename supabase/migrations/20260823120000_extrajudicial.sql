-- Phase 3 — the extrajudicial axis on public.ejecutados.
--
-- Every case starts judicial. When the debtor makes contact and agrees to
-- settle, it becomes extrajudicial — which the firm prefers, because it means a
-- channel to the debtor exists.
--
-- `via` is an axis PARALLEL to `movimiento`, not a movimiento value (locked
-- decision #15): the debtor can call at any procedural stage, and the case keeps
-- whatever movimiento it already had. Nothing is added to the movimiento CHECK
-- list here, deliberately.
--
-- Instalments are computed, not stored (Fran, 2026-08-18). Only the three inputs
-- live here; lib/domain/convenio.ts derives the schedule on the fly for the
-- escrito. No cuotas child table, no per-instalment paid flags — that can be
-- added later without a data migration if the firm ever needs to reconcile
-- partial payments against cobros_pagos.
--
-- `telefono` is NOT here: it landed in 20260820120000_demanda_foundation and
-- shows on judicial and extrajudicial cases alike (Fran was explicit that it is
-- relevant to the full view regardless of via).

-- Every value in every CHECK list carries its comma (gotcha #1) — a missing one
-- concatenates two literals silently and costs an hour.
ALTER TABLE public.ejecutados
  ADD COLUMN via TEXT NOT NULL DEFAULT 'judicial'
    CHECK (via IN ('judicial','extrajudicial')),
  -- The three settlement fields. NULL on every judicial case: they are only
  -- meaningful under an agreement, and the "Volver a judicial" action clears
  -- them so a stale monto can never feed the convenio.
  ADD COLUMN monto_acuerdo NUMERIC,
  ADD COLUMN cuotas INTEGER CHECK (cuotas IN (1,3,6,12)),
  ADD COLUMN fecha_vencimiento DATE;

COMMENT ON COLUMN public.ejecutados.via IS
  'judicial | extrajudicial. An axis parallel to movimiento, never a movimiento value: a case can be at any procedural stage when the debtor calls.';

-- The /ejecutados filter reads this, and an extrajudicial case is the rare one.
CREATE INDEX idx_ejecutados_via
  ON public.ejecutados(estudio_id, via) WHERE archived_at IS NULL;

DO $$
DECLARE
  judiciales INTEGER;
BEGIN
  SELECT count(*) INTO judiciales FROM public.ejecutados WHERE via = 'judicial';
  RAISE NOTICE 'ejecutados defaulted to via=judicial: %', judiciales;
END $$;
