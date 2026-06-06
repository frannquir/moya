
DELETE FROM public.honorarios WHERE monto_total_jus NOT IN (3.5, 7);

ALTER TABLE public.honorarios ALTER COLUMN monto_total_jus DROP DEFAULT;
ALTER TABLE public.honorarios DROP CONSTRAINT IF EXISTS honorarios_monto_total_jus_check;
ALTER TABLE public.honorarios ADD CONSTRAINT honorarios_tipo_jus_check
  CHECK (monto_total_jus IN (3.5, 7));

ALTER TABLE public.honorarios_pagos DROP CONSTRAINT IF EXISTS honorarios_pagos_monto_jus_check;

DELETE FROM public.honorarios_pagos WHERE monto_jus <= 0;
ALTER TABLE public.honorarios_pagos ADD CONSTRAINT honorarios_pagos_monto_jus_check
  CHECK (monto_jus > 0);


CREATE OR REPLACE FUNCTION public.check_honorario_pago_cap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cap NUMERIC;
  paid NUMERIC;
BEGIN
  IF NEW.archived_at IS NOT NULL THEN
    RETURN NEW; 
  END IF;
  SELECT monto_total_jus INTO cap FROM public.honorarios WHERE id = NEW.honorario_id;
  SELECT COALESCE(SUM(monto_jus), 0) INTO paid
    FROM public.honorarios_pagos
    WHERE honorario_id = NEW.honorario_id
      AND archived_at IS NULL
      AND id <> NEW.id;
  IF paid + NEW.monto_jus > cap THEN
    RAISE EXCEPTION 'Pago excede el honorario: % + % > % JUS', paid, NEW.monto_jus, cap;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_honorario_pago_cap ON public.honorarios_pagos;
CREATE TRIGGER trg_honorario_pago_cap
  BEFORE INSERT OR UPDATE ON public.honorarios_pagos
  FOR EACH ROW EXECUTE FUNCTION public.check_honorario_pago_cap();
