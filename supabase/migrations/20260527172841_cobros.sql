
CREATE TABLE public.cobros_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  ejecutado_id UUID NOT NULL REFERENCES public.ejecutados(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  monto NUMERIC NOT NULL DEFAULT 0 CHECK (monto >= 0),
  estado TEXT NOT NULL DEFAULT 'Solicitado' CHECK (estado IN ('Solicitado', 'Proveído')),
  nota TEXT NOT NULL DEFAULT '',
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,

  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cobros_pagos_estudio
  ON public.cobros_pagos(estudio_id) WHERE archived_at IS NULL;
CREATE INDEX idx_cobros_pagos_ejecutado
  ON public.cobros_pagos(ejecutado_id, fecha DESC) WHERE archived_at IS NULL;

ALTER TABLE public.cobros_pagos ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_cobros_pagos_updated_at
  BEFORE UPDATE ON public.cobros_pagos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Estudio members read cobros_pagos"
  ON public.cobros_pagos FOR SELECT
  USING (estudio_id = public.current_estudio_id());

CREATE POLICY "Estudio members insert cobros_pagos"
  ON public.cobros_pagos FOR INSERT
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Estudio members update cobros_pagos"
  ON public.cobros_pagos FOR UPDATE
  USING (estudio_id = public.current_estudio_id())
  WITH CHECK (estudio_id = public.current_estudio_id());

CREATE VIEW public.cobros_totals AS
SELECT
  e.id AS ejecutado_id,
  e.estudio_id,
  COALESCE(SUM(cp.monto) FILTER (
    WHERE cp.estado = 'Solicitado' AND cp.archived_at IS NULL
  ), 0) AS total_solicitado,
  COALESCE(SUM(cp.monto) FILTER (
    WHERE cp.estado = 'Proveído' AND cp.archived_at IS NULL
  ), 0) AS total_proveido,
  COUNT(*) FILTER (WHERE cp.archived_at IS NULL) AS pagos_count
FROM public.ejecutados e
LEFT JOIN public.cobros_pagos cp ON cp.ejecutado_id = e.id
WHERE e.archived_at IS NULL
GROUP BY e.id, e.estudio_id;

GRANT SELECT ON public.cobros_totals TO authenticated;