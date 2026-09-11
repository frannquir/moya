-- The four figures the BCRA publishes, and a change log for both global values.
--
-- Decision (Fran, 2026-09-05), two parts:
--
-- 1. bcra_tasas stored one number per month. The BCRA page publishes a row of
--    six columns and that is what gets copy-pasted:
--
--      MES     AÑO   Fin. Saldos  Ints. Punitorios  T.E.A.     C.F.T.
--      JUNIO   2025  90.5200      45.2600           109.5292   109.5292
--
--    Everything after "Fin. Saldos" was being discarded on paste. The other
--    three are kept now — the punitorios rate above all, which is the one a
--    liquidación needs to justify its punitive interest and which the app could
--    not show at all.
--
--    tna is NOT renamed: it already holds "Fin. Saldos" (the first rate on the
--    line, which is what parsePastedTasaLine picked), calcularLiquidacion()
--    reads it in five places, and a rename buys nothing a COMMENT does not.
--
-- 2. Both system_config and bcra_tasas are now writable from the UI, and both
--    are global. A wrong JUS or a mistyped rate changes money on every escrito
--    of every estudio, so every change is logged with who made it and what it
--    replaced, and can be put back. The log is written by triggers, not by the
--    server actions: these two tables have been edited by hand over SQL for
--    months, and that is exactly the kind of change worth a record.

begin;

-- --------------------------------------------------------------------------
-- 1. The rest of the BCRA row
-- --------------------------------------------------------------------------

ALTER TABLE public.bcra_tasas
  ADD COLUMN IF NOT EXISTS ints_punitorios NUMERIC,
  ADD COLUMN IF NOT EXISTS tea NUMERIC,
  ADD COLUMN IF NOT EXISTS cft NUMERIC,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Nullable, all three: the 303 rows already loaded only ever had the first
-- figure, and inventing the other three from it would be a fabricated number in
-- a table that feeds judicial documents. They stay empty until a month is
-- re-pasted in full.
COMMENT ON COLUMN public.bcra_tasas.tna IS
  'Financiación de saldos (TNA %) — the first rate on the BCRA line. The rate calcularLiquidacion() applies.';
COMMENT ON COLUMN public.bcra_tasas.ints_punitorios IS
  'Intereses punitorios (TNA %), published at half the financiación rate (Ley 25.065 art. 18). NULL for months loaded before 2026-09-05.';
COMMENT ON COLUMN public.bcra_tasas.tea IS
  'Tasa Efectiva Anual (%) — the financiación rate compounded. NULL for months loaded before 2026-09-05.';
COMMENT ON COLUMN public.bcra_tasas.cft IS
  'Costo Financiero Total (%) — TEA plus charges and taxes. NULL for months loaded before 2026-09-05.';

DROP TRIGGER IF EXISTS trg_bcra_tasas_updated_at ON public.bcra_tasas;
CREATE TRIGGER trg_bcra_tasas_updated_at
  BEFORE UPDATE ON public.bcra_tasas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- --------------------------------------------------------------------------
-- 2. The change log
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.config_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tipo TEXT NOT NULL CHECK (tipo IN ('jus', 'tasa')),
  -- What was changed, ready to print: 'JUS' or 'JUNIO 2025'.
  etiqueta TEXT NOT NULL,

  -- Full snapshots. NULL previous means the value was created, not replaced --
  -- which is also what makes it un-restorable, and the UI says so.
  valor_anterior JSONB,
  valor_nuevo JSONB NOT NULL,

  changed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Denormalised on purpose: lawyer_profiles is readable only by its owner, so
  -- a join would show every entry as "—" to everyone but its author. The name at
  -- the time of the change is also the more honest thing for a log to record.
  changed_by_nombre TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_historial_reciente
  ON public.config_historial(created_at DESC);

ALTER TABLE public.config_historial ENABLE ROW LEVEL SECURITY;

-- Readable by anyone signed in, like the two tables it tracks. Nobody writes it
-- directly: the triggers below are SECURITY DEFINER, so there is no INSERT,
-- UPDATE or DELETE policy and the log cannot be edited or cleared from the app.
DROP POLICY IF EXISTS "Authenticated users read config_historial" ON public.config_historial;
CREATE POLICY "Authenticated users read config_historial"
  ON public.config_historial FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- The display name of whoever is making the change, '' for a service-role or
-- psql edit (no auth.uid()) — which is itself worth seeing in the log.
CREATE OR REPLACE FUNCTION public.current_user_nombre()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(nombre, '') FROM public.lawyer_profiles WHERE user_id = auth.uid()),
    ''
  );
$$;


CREATE OR REPLACE FUNCTION public.log_jus_config_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- system_config is a key/value bag; only the JUS is a tracked value today.
  IF NEW.key <> 'jus_config' THEN
    RETURN NEW;
  END IF;
  -- A save that changed nothing is not history.
  IF TG_OP = 'UPDATE' AND OLD.value IS NOT DISTINCT FROM NEW.value THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.config_historial
    (tipo, etiqueta, valor_anterior, valor_nuevo, changed_by_user_id, changed_by_nombre)
  VALUES (
    'jus',
    'JUS',
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.value ELSE NULL END,
    NEW.value,
    auth.uid(),
    public.current_user_nombre()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_jus_config ON public.system_config;
CREATE TRIGGER trg_log_jus_config
  AFTER INSERT OR UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.log_jus_config_change();


CREATE OR REPLACE FUNCTION public.log_bcra_tasa_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  anterior JSONB;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Re-pasting the same month unchanged is the normal way to load a block that
    -- overlaps what is already there; it should not fill the log with noise.
    IF OLD.tna IS NOT DISTINCT FROM NEW.tna
       AND OLD.ints_punitorios IS NOT DISTINCT FROM NEW.ints_punitorios
       AND OLD.tea IS NOT DISTINCT FROM NEW.tea
       AND OLD.cft IS NOT DISTINCT FROM NEW.cft THEN
      RETURN NEW;
    END IF;
    anterior := jsonb_build_object(
      'anio', OLD.anio, 'mes', OLD.mes, 'tna', OLD.tna,
      'ints_punitorios', OLD.ints_punitorios, 'tea', OLD.tea, 'cft', OLD.cft
    );
  END IF;

  INSERT INTO public.config_historial
    (tipo, etiqueta, valor_anterior, valor_nuevo, changed_by_user_id, changed_by_nombre)
  VALUES (
    'tasa',
    NEW.mes || ' ' || NEW.anio,
    anterior,
    jsonb_build_object(
      'anio', NEW.anio, 'mes', NEW.mes, 'tna', NEW.tna,
      'ints_punitorios', NEW.ints_punitorios, 'tea', NEW.tea, 'cft', NEW.cft
    ),
    auth.uid(),
    public.current_user_nombre()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_bcra_tasa ON public.bcra_tasas;
CREATE TRIGGER trg_log_bcra_tasa
  AFTER INSERT OR UPDATE ON public.bcra_tasas
  FOR EACH ROW EXECUTE FUNCTION public.log_bcra_tasa_change();

commit;
