
CREATE TABLE public.honorarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  ejecutado_id UUID NOT NULL REFERENCES public.ejecutados(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  monto_total_jus NUMERIC NOT NULL DEFAULT 0 CHECK (monto_total_jus >= 0),
  observaciones TEXT NOT NULL DEFAULT '',

  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(ejecutado_id)  -- one honorario per ejecutado max
);

CREATE INDEX idx_honorarios_estudio ON public.honorarios(estudio_id) WHERE archived_at IS NULL;
CREATE INDEX idx_honorarios_ejecutado ON public.honorarios(ejecutado_id) WHERE archived_at IS NULL;

ALTER TABLE public.honorarios ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_honorarios_updated_at
  BEFORE UPDATE ON public.honorarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Estudio members read honorarios"
  ON public.honorarios FOR SELECT
  USING (estudio_id = public.current_estudio_id());

CREATE POLICY "Estudio members insert honorarios"
  ON public.honorarios FOR INSERT
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Estudio members update honorarios"
  ON public.honorarios FOR UPDATE
  USING (estudio_id = public.current_estudio_id())
  WITH CHECK (estudio_id = public.current_estudio_id());


CREATE TABLE public.honorarios_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  honorario_id UUID NOT NULL REFERENCES public.honorarios(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  monto_jus NUMERIC NOT NULL DEFAULT 0 CHECK (monto_jus >= 0),
  monto_ars NUMERIC NOT NULL DEFAULT 0 CHECK (monto_ars >= 0),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  nota TEXT NOT NULL DEFAULT '',

  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_honorarios_pagos_honorario
  ON public.honorarios_pagos(honorario_id, fecha DESC)
  WHERE archived_at IS NULL;

CREATE INDEX idx_honorarios_pagos_estudio
  ON public.honorarios_pagos(estudio_id) WHERE archived_at IS NULL;

ALTER TABLE public.honorarios_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Estudio members read honorarios_pagos"
  ON public.honorarios_pagos FOR SELECT
  USING (estudio_id = public.current_estudio_id());

CREATE POLICY "Estudio members insert honorarios_pagos"
  ON public.honorarios_pagos FOR INSERT
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Estudio members update honorarios_pagos"
  ON public.honorarios_pagos FOR UPDATE
  USING (estudio_id = public.current_estudio_id())
  WITH CHECK (estudio_id = public.current_estudio_id());

CREATE VIEW public.honorarios_with_balance AS
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
  h.monto_total_jus - COALESCE(
    (SELECT SUM(hp.monto_jus)
     FROM public.honorarios_pagos hp
     WHERE hp.honorario_id = h.id AND hp.archived_at IS NULL),
    0
  ) AS pendiente_jus
FROM public.honorarios h
WHERE h.archived_at IS NULL;

GRANT SELECT ON public.honorarios_with_balance TO authenticated;