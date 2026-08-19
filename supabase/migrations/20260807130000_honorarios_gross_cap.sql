-- Honorarios: pagos may exceed the regulated base by tax.
--
-- Decision (Fran/client, 2026-07-22): IVA 21% + aportes 10%, additive, so the
-- ceiling on collections is base x 1.31 — 7 JUS -> 9.17, 3.5 JUS -> 4.59. The
-- honorario TYPES are unchanged; only what may be collected against one grows.
--
-- The cap is rounded to 2 dp because honorarios_pagos.monto_jus is entered at
-- that precision: 3.5 x 1.31 = 4.585 is not a payable amount, and a ceiling the
-- lawyer cannot actually type is a ceiling that looks broken. ROUND() on NUMERIC
-- is half-away-from-zero, matching roundJus() in lib/domain/honorarios.ts.

-- Single SQL-side definition of the multiplier. Mirrors TAX_MULTIPLIER in
-- lib/domain/honorarios.ts, which is assertion-guarded in honorarios.test.ts.
CREATE OR REPLACE FUNCTION public.honorario_gross_cap(base_jus NUMERIC)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT ROUND(COALESCE(base_jus, 0) * 1.31, 2);
$$;

COMMENT ON FUNCTION public.honorario_gross_cap(NUMERIC) IS
  'Max collectable JUS for a regulated base: base + IVA 21% + aportes 10%, rounded to the 2-dp precision of honorarios_pagos.monto_jus.';


CREATE OR REPLACE FUNCTION public.check_honorario_pago_cap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  base NUMERIC;
  cap  NUMERIC;
  paid NUMERIC;
BEGIN
  IF NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT monto_total_jus INTO base FROM public.honorarios WHERE id = NEW.honorario_id;
  cap := public.honorario_gross_cap(base);
  SELECT COALESCE(SUM(monto_jus), 0) INTO paid
    FROM public.honorarios_pagos
    WHERE honorario_id = NEW.honorario_id
      AND archived_at IS NULL
      AND id <> NEW.id;
  IF paid + NEW.monto_jus > cap THEN
    RAISE EXCEPTION
      'El pago excede el maximo cobrable: % + % > % JUS (honorario % + IVA 21%% + aportes 10%%)',
      paid, NEW.monto_jus, cap, base;
  END IF;
  RETURN NEW;
END;
$$;


-- The list and card read "pendiente" from this view, so the gross figures have
-- to live here too — changing remainingJus() in TS alone would leave /honorarios
-- reporting against the base cap. Existing columns keep their name, type and
-- position (CREATE OR REPLACE VIEW only permits appending).
CREATE OR REPLACE VIEW public.honorarios_with_balance AS
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
  COALESCE(
    (SELECT SUM(hp.monto_jus)
     FROM public.honorarios_pagos hp
     WHERE hp.honorario_id = h.id AND hp.archived_at IS NULL),
    0
  ) AS pagado_jus,
  -- Remaining against the regulated base: zero means the fee is covered, but
  -- the tax on it may still be outstanding.
  h.monto_total_jus - COALESCE(
    (SELECT SUM(hp.monto_jus)
     FROM public.honorarios_pagos hp
     WHERE hp.honorario_id = h.id AND hp.archived_at IS NULL),
    0
  ) AS pendiente_jus,
  public.honorario_gross_cap(h.monto_total_jus) AS cap_gross_jus,
  -- Remaining against the gross cap: what may still be collected in total.
  public.honorario_gross_cap(h.monto_total_jus) - COALESCE(
    (SELECT SUM(hp.monto_jus)
     FROM public.honorarios_pagos hp
     WHERE hp.honorario_id = h.id AND hp.archived_at IS NULL),
    0
  ) AS pendiente_gross_jus
FROM public.honorarios h
WHERE h.archived_at IS NULL;

GRANT SELECT ON public.honorarios_with_balance TO authenticated;
