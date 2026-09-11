-- Honorarios: every ejecutado starts with one at 7 JUS, and the ceiling becomes
-- negotiable instead of always being base x 1.31.
--
-- Decision (Fran, 2026-09-05 / 2026-09-11), three parts:
--
-- 1. 7 JUS is the honorario, not a suggestion the lawyer has to confirm. Until
--    now the row only existed once someone pressed "Fijar", so a case with no
--    honorario looked like a case with no fee. Every ejecutado gets one now, at
--    7, still typeable if a case is regulated differently.
--
-- 2. The collectable ceiling can be settled with the debtor, and it is settled
--    IN PESOS -- so it is stored in pesos. The first draft of this migration
--    held it as max_acordado_jus, which is wrong in a way that only shows up
--    later: an agreement of $257.102,50 stored as 4,83 JUS is already $8 off at
--    the JUS of the day it was agreed, and silently becomes $289.800 the next
--    time the JUS moves. A negotiated figure is a fixed peso amount; the arancel
--    is a JUS amount. They are different kinds of number, and the column name
--    now says which is which.
--
-- 3. Consequently the pago ceiling is checked in whichever unit the ceiling is
--    denominated in: pesos received against a negotiated peso ceiling, JUS
--    collected against the arancel's base x 1.31. Both sides of each comparison
--    are then the same kind of number, so neither drifts when the JUS moves.
--    honorarios_pagos already stores monto_jus AND monto_ars, so nothing new has
--    to be recorded for this to work.

begin;

-- The JUS of the day, for the places that genuinely have to cross between the
-- two units (the view's display columns). STABLE, not IMMUTABLE: it reads a
-- table. Deliberately never used inside the pago check -- that is the point of
-- part 3 above.
CREATE OR REPLACE FUNCTION public.jus_value()
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT NULLIF((value ->> 'value')::numeric, 0)
    FROM public.system_config
   WHERE key = 'jus_config';
$$;

COMMENT ON FUNCTION public.jus_value() IS
  'Current JUS value from system_config; NULL if unset or zero. Display conversions only — never for enforcing a ceiling.';


-- Ceiling settled with the debtor, in PESOS. NULL = not negotiated, use the
-- legal cap. Zero or negative is not a ceiling, it is a mistake: the pago
-- trigger would then reject every payment on a honorario that still reads open.
ALTER TABLE public.honorarios
  ADD COLUMN IF NOT EXISTS max_acordado_ars NUMERIC;

ALTER TABLE public.honorarios DROP CONSTRAINT IF EXISTS honorarios_max_acordado_positivo;
ALTER TABLE public.honorarios ADD CONSTRAINT honorarios_max_acordado_positivo
  CHECK (max_acordado_ars IS NULL OR max_acordado_ars > 0);

COMMENT ON COLUMN public.honorarios.max_acordado_ars IS
  'Ceiling settled with the debtor, in pesos. NULL falls back to honorario_gross_cap(monto_total_jus), which is denominated in JUS. Overrides it in both directions.';


-- The earlier draft's cross-unit helper took a JUS base and a JUS "acordado"
-- and returned one number pretending both were the same kind of thing. There is
-- no correct version of it now that the two ceilings are denominated
-- differently, so it goes rather than getting patched.
DROP FUNCTION IF EXISTS public.honorario_cap_cobrable(NUMERIC, NUMERIC);


-- Same trigger, but the comparison happens in the ceiling's own unit. The
-- message names which of the two it hit, because "excede el maximo" against a
-- negotiated amount reads as a bug to someone who remembers the honorario is
-- 7 JUS and expects 9,17.
CREATE OR REPLACE FUNCTION public.check_honorario_pago_cap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  base      NUMERIC;
  acordado  NUMERIC;
  cap_jus   NUMERIC;
  paid_jus  NUMERIC;
  paid_ars  NUMERIC;
BEGIN
  IF NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT monto_total_jus, max_acordado_ars
    INTO base, acordado
    FROM public.honorarios
   WHERE id = NEW.honorario_id;

  IF acordado IS NOT NULL THEN
    -- Negotiated: a peso ceiling against the pesos actually received. Both
    -- sides are historical amounts, so the JUS of the day never enters.
    SELECT COALESCE(SUM(monto_ars), 0) INTO paid_ars
      FROM public.honorarios_pagos
     WHERE honorario_id = NEW.honorario_id
       AND archived_at IS NULL
       AND id <> NEW.id;

    IF paid_ars + NEW.monto_ars > acordado THEN
      RAISE EXCEPTION
        'El pago excede el maximo acordado con el ejecutado: % + % > % pesos',
        paid_ars, NEW.monto_ars, acordado;
    END IF;
  ELSE
    -- Arancel: a JUS ceiling against the JUS collected.
    cap_jus := public.honorario_gross_cap(base);

    SELECT COALESCE(SUM(monto_jus), 0) INTO paid_jus
      FROM public.honorarios_pagos
     WHERE honorario_id = NEW.honorario_id
       AND archived_at IS NULL
       AND id <> NEW.id;

    IF paid_jus + NEW.monto_jus > cap_jus THEN
      RAISE EXCEPTION
        'El pago excede el maximo cobrable: % + % > % JUS (honorario % + IVA 21%% + aportes 10%%)',
        paid_jus, NEW.monto_jus, cap_jus, base;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- CREATE OR REPLACE keeps the existing columns' names, types and order and only
-- appends. cap_gross_jus / pendiente_gross_jus keep their names and their JUS
-- unit -- lib/data/estadisticas.ts reads them in three places and /honorarios in
-- two -- but they now mean the EFFECTIVE ceiling, converting a negotiated peso
-- amount at today's JUS so "still owed" stays comparable across cases. The peso
-- columns beside them are what the card prints, and for a negotiated honorario
-- cap_cobrable_ars is the exact agreed number, not a conversion.
CREATE OR REPLACE VIEW public.honorarios_with_balance AS
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
  -- Still measured against the regulated base: zero means the fee proper is
  -- covered, whatever ceiling was agreed on top of it.
  h.monto_total_jus - COALESCE(p.pagado_jus, 0) AS pendiente_jus,
  -- EFFECTIVE ceiling in JUS, and what is left under it.
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
  -- The arancel reference, kept alongside so the card can print
  -- "7 JUS + IVA + aportes" next to whatever was actually agreed.
  public.honorario_gross_cap(h.monto_total_jus) AS cap_legal_jus,
  -- The peso side — what the card and the escritos print.
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
  ) AS pendiente_cobrable_ars
FROM public.honorarios h
LEFT JOIN pagos p ON p.honorario_id = h.id
WHERE h.archived_at IS NULL;

GRANT SELECT ON public.honorarios_with_balance TO authenticated;


-- Every new ejecutado gets its honorario at 7 JUS. A trigger and not an app-side
-- call so no creation path can forget it -- /ejecutados/new, the demanda flow and
-- the migration import all go through the same INSERT.
--
-- SECURITY DEFINER: the honorarios INSERT policy wants created_by_user_id =
-- auth.uid(), which is not satisfiable from the service-role import path. The
-- row it writes is derived entirely from NEW, so there is nothing to escalate.
--
-- Archived rows are skipped, matching the backfill below: a case that arrives
-- already closed -- as the 2 Cancelados of the 2026-09-05 import did -- does not
-- need a fee nobody will collect.
CREATE OR REPLACE FUNCTION public.create_default_honorario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.honorarios (estudio_id, ejecutado_id, created_by_user_id, monto_total_jus)
  VALUES (NEW.estudio_id, NEW.id, auth.uid(), 7)
  ON CONFLICT (ejecutado_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ejecutado_default_honorario ON public.ejecutados;
CREATE TRIGGER trg_ejecutado_default_honorario
  AFTER INSERT ON public.ejecutados
  FOR EACH ROW EXECUTE FUNCTION public.create_default_honorario();


-- Backfill the cases that predate the trigger. Archived ones are left alone:
-- they are closed, and a fee nobody will collect is noise on /honorarios.
do $$
declare
  faltantes integer;
begin
  select count(*) into faltantes
    from public.ejecutados e
   where e.archived_at is null
     and not exists (select 1 from public.honorarios h where h.ejecutado_id = e.id);

  insert into public.honorarios (estudio_id, ejecutado_id, monto_total_jus)
  select e.estudio_id, e.id, 7
    from public.ejecutados e
   where e.archived_at is null
     and not exists (select 1 from public.honorarios h where h.ejecutado_id = e.id);

  raise notice 'honorarios creados a 7 JUS para % ejecutados sin honorario', faltantes;
end $$;

commit;
