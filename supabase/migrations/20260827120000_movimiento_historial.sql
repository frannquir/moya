-- A record of movimiento transitions. `ejecutados.movimiento` is overwritten in
-- place, so updated_at says a row changed but not that it went from Enviar
-- Cédula to Pedir Sentencia.
--
-- History starts here: the 319 existing cases have no recoverable past. Also the
-- fix for /escritos ranking by updated_at (gotcha #38), which cannot tell a
-- phone-number edit from a case advancing.

CREATE TABLE public.movimiento_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  ejecutado_id UUID NOT NULL REFERENCES public.ejecutados(id) ON DELETE CASCADE,

  -- Both nullable: a case can move from "sin movimiento" to a stage. The CHECK
  -- list on ejecutados.movimiento is not repeated — a log has to stay writable
  -- if that list changes.
  de TEXT,
  a  TEXT,

  -- NULL outside a user session: a migration, a script, the service role.
  changed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The feed reads "latest first, per estudio".
CREATE INDEX idx_movimiento_historial_estudio
  ON public.movimiento_historial(estudio_id, created_at DESC);
-- And the ejecutado page reads one case's own history.
CREATE INDEX idx_movimiento_historial_ejecutado
  ON public.movimiento_historial(ejecutado_id, created_at DESC);

ALTER TABLE public.movimiento_historial ENABLE ROW LEVEL SECURITY;

-- Mirrors the ejecutados delegation overlay (decision #24).
CREATE POLICY "Estudio members read movimiento_historial"
  ON public.movimiento_historial FOR SELECT
  USING (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
    )
  );

-- No INSERT/UPDATE/DELETE policies: rows come only from the SECURITY DEFINER
-- trigger below.

CREATE OR REPLACE FUNCTION public.log_movimiento_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.movimiento_historial (estudio_id, ejecutado_id, de, a, changed_by_user_id)
  VALUES (NEW.estudio_id, NEW.id, OLD.movimiento, NEW.movimiento, auth.uid());
  RETURN NEW;
END;
$$;

-- IS DISTINCT FROM, not <>: a move to or from NULL is a real transition.
CREATE TRIGGER trg_log_movimiento_change
  AFTER UPDATE ON public.ejecutados
  FOR EACH ROW
  WHEN (OLD.movimiento IS DISTINCT FROM NEW.movimiento)
  EXECUTE FUNCTION public.log_movimiento_change();

DO $$
BEGIN
  RAISE NOTICE 'movimiento_historial ready; history starts now (% existing ejecutados have none)',
    (SELECT count(*) FROM public.ejecutados WHERE archived_at IS NULL);
END $$;
