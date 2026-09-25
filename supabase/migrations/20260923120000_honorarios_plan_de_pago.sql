-- Honorarios: a payment plan — an anticipo, N monthly cuotas and the first
-- cuota's date — so the convenio can print how the honorarios arrive, and the
-- deuda can start the month after the last cuota without the lawyer typing it
-- (B1, 2026-09-23).
--
-- Read 20260905120000_honorarios_max_acordado.sql first. Its header is why every
-- money column here carries its unit in its name.
--
-- Four columns on public.honorarios. All NULL on every existing row, which is
-- exactly today's behaviour: no plan, one payment.
--
--   plan_anticipo_ars   NUMERIC  Paid on signing. PART of the total, never on
--                                top of it; the remainder is what splits.
--   plan_cuotas         INTEGER  How many monthly cuotas the remainder splits
--                                into. Free 1..12 (Fran, 2026-09-23) — his own
--                                example is 2, which the deuda's 1/3/6/12 lacks.
--   plan_fecha_primera  DATE     The first cuota's vencimiento, typed by the
--                                lawyer. Cuota 1 falls ON it; the rest step
--                                monthly from it.
--   plan_cap_legal_ars  NUMERIC  The legal ceiling in pesos, FROZEN when the
--                                plan was made. Only when nothing was settled.
--
-- THE UNITS DECISION (Fran, 2026-09-23)
--
-- A plan splits a FIXED PESO amount, because the convenio prints pesos. A
-- honorario has two possible ceilings and only one of them is that already:
-- max_acordado_ars. The other, the legal ceiling (base x 1,31), is a JUS amount
-- whose value in pesos moves every time the JUS does.
--
-- The question put to Fran was whether a plan should REQUIRE a settled
-- max_acordado_ars. His answer: no — use the default, let an amount settled in
-- pesos override it, and tell the lawyer the default was the one used. So:
--
--   * max_acordado_ars set: the plan splits max_acordado_ars. Already a fixed
--     peso figure, so nothing is copied.
--   * no max_acordado_ars: the plan splits the legal ceiling converted to pesos
--     AT THE JUS OF THE DAY THE PLAN IS MADE, stored in plan_cap_legal_ars. The
--     name says both halves — the legal cap, in pesos, owned by the plan.
--
-- Frozen, and not converted at render time, because converting at render time
-- is precisely the bug 20260905120000 opens with: the convenio says "$488.137,44
-- en DOS CUOTAS de $244.068,72", and re-derived from October's JUS the same
-- document would print another number, so the one the debtor signed would match
-- nothing on screen.
--
-- Not written into max_acordado_ars either (the recommendation this package
-- started from), because nobody settled it: the card presents a máximo acordado
-- as a negotiated figure, and check_honorario_pago_cap() would switch that
-- honorario from comparing JUS to comparing pesos. Fran chose for the default to
-- stay the default.
--
-- WHAT THAT COSTS, written down so it is not rediscovered as a bug: the pago
-- ceiling does NOT move. check_honorario_pago_cap() and the view keep measuring
-- a legal honorario in JUS, as they must. When the JUS rises during a plan on
-- the default, a debtor who pays every cuota has paid the plan's pesos, and the
-- honorario can still show a JUS pendiente afterwards — the frozen figure buys
-- fewer JUS each month. The gap is real (the arancel moved). A lawyer who wants
-- the plan's figure to BE the ceiling settles it, and that is what
-- max_acordado_ars is for.
--
-- ONE CEILING PER PLAN, enforced below: with a plan, exactly one of
-- max_acordado_ars / plan_cap_legal_ars is set; without one, plan_cap_legal_ars
-- is NULL. So settling a máximo on a honorario whose plan is on the default has
-- to clear the snapshot in the same write, and clearing the máximo under a plan
-- has to freeze a fresh default (and tell the lawyer). B2's setHonorarioMonto
-- does both. What this prevents is a months-old snapshot quietly coming back
-- the day somebody clears a máximo.
--
-- WHAT DOES NOT MOVE
--
--   * check_honorario_pago_cap(): untouched. The plan is a schedule, not a
--     second ceiling — a debtor who pays early, or more than a cuota, is bounded
--     by exactly today's cap.
--   * create_default_honorario(): untouched. A new honorario has no plan.
--   * RLS: the columns inherit honorarios' estudio-scoped policies.
--   * No honorarios_cuotas table and no per-cuota paid flag. The schedule is
--     derived (lib/domain/honorarios-plan.ts), like the deuda's in convenio.ts,
--     and honorarios_pagos stays a free ledger.
--
-- The view is re-created WITH (security_invoker = on). CREATE OR REPLACE VIEW
-- REPLACES a view's options with the ones the new statement carries, so the
-- plain form would silently undo 20260921120000 and hand every estudio's
-- honorarios back to any logged-in user (gotcha #56). The guard at the bottom
-- aborts if that ever happens.

begin;

ALTER TABLE public.honorarios
  ADD COLUMN IF NOT EXISTS plan_anticipo_ars  NUMERIC,
  ADD COLUMN IF NOT EXISTS plan_cuotas        INTEGER,
  ADD COLUMN IF NOT EXISTS plan_fecha_primera DATE,
  ADD COLUMN IF NOT EXISTS plan_cap_legal_ars NUMERIC;

COMMENT ON COLUMN public.honorarios.plan_anticipo_ars IS
  'Anticipo of the honorarios plan, in pesos, paid on signing. Part of the total the plan splits, never on top of it. NULL = no anticipo.';
COMMENT ON COLUMN public.honorarios.plan_cuotas IS
  'Monthly cuotas the plan remainder splits into, 1..12. NULL = no plan: one payment, as before 2026-09-23.';
COMMENT ON COLUMN public.honorarios.plan_fecha_primera IS
  'Vencimiento of the first plan cuota, typed by the lawyer. The rest step monthly from it (lib/domain/honorarios-plan.ts).';
COMMENT ON COLUMN public.honorarios.plan_cap_legal_ars IS
  'The legal ceiling (base x 1,31) in pesos at the JUS of the day the plan was made, frozen. What the plan splits when there is no max_acordado_ars; NULL otherwise. Never used to check a pago.';


-- The same set lib/domain/honorarios-plan.ts offers (PLAN_CUOTAS_MIN/MAX).
-- honorarios-plan.test.ts reads this line; change one, change both.
ALTER TABLE public.honorarios DROP CONSTRAINT IF EXISTS honorarios_plan_cuotas_rango;
ALTER TABLE public.honorarios ADD CONSTRAINT honorarios_plan_cuotas_rango
  CHECK (plan_cuotas IS NULL OR plan_cuotas BETWEEN 1 AND 12);

-- Cuotas with no first date would render a schedule with no dates, and a date
-- with no cuotas is a plan with nothing in it.
ALTER TABLE public.honorarios DROP CONSTRAINT IF EXISTS honorarios_plan_cuotas_y_fecha;
ALTER TABLE public.honorarios ADD CONSTRAINT honorarios_plan_cuotas_y_fecha
  CHECK (num_nonnulls(plan_cuotas, plan_fecha_primera) IN (0, 2));

-- Mirrors honorarios_max_acordado_positivo: zero is not an anticipo, it is a
-- mistake, and "no anticipo" is NULL.
ALTER TABLE public.honorarios DROP CONSTRAINT IF EXISTS honorarios_plan_anticipo_positivo;
ALTER TABLE public.honorarios ADD CONSTRAINT honorarios_plan_anticipo_positivo
  CHECK (plan_anticipo_ars IS NULL OR plan_anticipo_ars > 0);

-- An anticipo is the first part of a plan. On its own nothing reads it — the
-- domain returns no plan without cuotas — so it would be stored and invisible.
-- A plan with cuotas and no anticipo is fine.
ALTER TABLE public.honorarios DROP CONSTRAINT IF EXISTS honorarios_plan_anticipo_con_plan;
ALTER TABLE public.honorarios ADD CONSTRAINT honorarios_plan_anticipo_con_plan
  CHECK (plan_anticipo_ars IS NULL OR plan_cuotas IS NOT NULL);

ALTER TABLE public.honorarios DROP CONSTRAINT IF EXISTS honorarios_plan_cap_legal_positivo;
ALTER TABLE public.honorarios ADD CONSTRAINT honorarios_plan_cap_legal_positivo
  CHECK (plan_cap_legal_ars IS NULL OR plan_cap_legal_ars > 0);

-- One ceiling per plan — see the header.
ALTER TABLE public.honorarios DROP CONSTRAINT IF EXISTS honorarios_plan_un_techo;
ALTER TABLE public.honorarios ADD CONSTRAINT honorarios_plan_un_techo
  CHECK (
    (plan_cuotas IS NULL AND plan_cap_legal_ars IS NULL)
    OR (plan_cuotas IS NOT NULL AND num_nonnulls(max_acordado_ars, plan_cap_legal_ars) = 1)
  );

-- An anticipo that reaches the total leaves nothing to split into cuotas. The
-- domain rejects it with a message first (validarPlanHonorarios); this is the
-- hard fence. Two consequences for whoever edits the ceiling under a plan:
-- lowering max_acordado_ars to or below the anticipo is refused here, the same
-- way lowering it below pagado_ars is refused in lib/data/honorarios.ts.
ALTER TABLE public.honorarios DROP CONSTRAINT IF EXISTS honorarios_plan_anticipo_bajo_techo;
ALTER TABLE public.honorarios ADD CONSTRAINT honorarios_plan_anticipo_bajo_techo
  CHECK (
    plan_anticipo_ars IS NULL
    OR plan_anticipo_ars < COALESCE(max_acordado_ars, plan_cap_legal_ars)
  );


-- Same body as 20260905120000, column for column; the four plan columns are
-- appended at the end, which is all CREATE OR REPLACE allows. They are passed
-- through untouched — the schedule is computed in TypeScript, not here — so the
-- card reads a honorario and its plan in one query (gotcha #30).
CREATE OR REPLACE VIEW public.honorarios_with_balance
WITH (security_invoker = on) AS
WITH pagos AS (
  SELECT honorario_id,
         COALESCE(SUM(monto_jus), 0) AS pagado_jus,
         COALESCE(SUM(monto_ars), 0) AS pagado_ars
    FROM public.honorarios_pagos
   WHERE archived_at IS NULL
   GROUP BY honorario_id
)
SELECT
  h.id,
  h.estudio_id,
  h.ejecutado_id,
  h.created_by_user_id,
  h.monto_total_jus,
  h.observaciones,
  h.archived_at,
  h.created_at,
  h.updated_at,
  COALESCE(p.pagado_jus, 0) AS pagado_jus,
  h.monto_total_jus - COALESCE(p.pagado_jus, 0) AS pendiente_jus,
  CASE
    WHEN h.max_acordado_ars IS NOT NULL AND public.jus_value() IS NOT NULL
      THEN ROUND(h.max_acordado_ars / public.jus_value(), 2)
    ELSE public.honorario_gross_cap(h.monto_total_jus)
  END AS cap_gross_jus,
  GREATEST(
    CASE
      WHEN h.max_acordado_ars IS NOT NULL AND public.jus_value() IS NOT NULL
        THEN ROUND(h.max_acordado_ars / public.jus_value(), 2)
      ELSE public.honorario_gross_cap(h.monto_total_jus)
    END - COALESCE(p.pagado_jus, 0),
    0
  ) AS pendiente_gross_jus,
  h.max_acordado_ars,
  public.honorario_gross_cap(h.monto_total_jus) AS cap_legal_jus,
  COALESCE(p.pagado_ars, 0) AS pagado_ars,
  COALESCE(
    h.max_acordado_ars,
    ROUND(public.honorario_gross_cap(h.monto_total_jus) * public.jus_value())
  ) AS cap_cobrable_ars,
  GREATEST(
    COALESCE(
      h.max_acordado_ars,
      ROUND(public.honorario_gross_cap(h.monto_total_jus) * public.jus_value())
    ) - COALESCE(p.pagado_ars, 0),
    0
  ) AS pendiente_cobrable_ars,
  h.plan_anticipo_ars,
  h.plan_cuotas,
  h.plan_fecha_primera,
  h.plan_cap_legal_ars
FROM public.honorarios h
LEFT JOIN pagos p ON p.honorario_id = h.id
WHERE h.archived_at IS NULL;

GRANT SELECT ON public.honorarios_with_balance TO authenticated;


-- A structural guard, not a count (gotcha #50): it holds on every database this
-- file can run on, fresh or live. Without security_invoker the view runs as its
-- owner, skips RLS, and returns all three estudios' honorarios.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'honorarios_with_balance'
       AND c.reloptions && ARRAY['security_invoker=on', 'security_invoker=true']
  ) THEN
    RAISE EXCEPTION 'honorarios_with_balance lost security_invoker: it would return every estudio (gotcha #56)';
  END IF;
END $$;

commit;
