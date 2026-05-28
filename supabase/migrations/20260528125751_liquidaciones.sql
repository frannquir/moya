
ALTER TABLE public.ejecutados
  ADD COLUMN fecha_desde DATE,
  ADD COLUMN fecha_hasta DATE,
  ADD COLUMN gastos NUMERIC NOT NULL DEFAULT 0 CHECK (gastos >= 0);

-- One liquidacion per ejecutado, upserted
CREATE TABLE public.liquidaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  ejecutado_id UUID NOT NULL REFERENCES public.ejecutados(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  cuenta TEXT NOT NULL DEFAULT '',
  apellido_nombre TEXT NOT NULL DEFAULT '',
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NOT NULL,
  capital NUMERIC NOT NULL DEFAULT 0 CHECK (capital >= 0),
  total_intereses NUMERIC NOT NULL DEFAULT 0,
  iva NUMERIC NOT NULL DEFAULT 0,
  gastos NUMERIC NOT NULL DEFAULT 0,
  monto_adeudado NUMERIC NOT NULL DEFAULT 0,

  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(ejecutado_id)
);

CREATE INDEX idx_liquidaciones_estudio
  ON public.liquidaciones(estudio_id) WHERE archived_at IS NULL;
CREATE INDEX idx_liquidaciones_ejecutado
  ON public.liquidaciones(ejecutado_id) WHERE archived_at IS NULL;

ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_liquidaciones_updated_at
  BEFORE UPDATE ON public.liquidaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Estudio members read liquidaciones"
  ON public.liquidaciones FOR SELECT
  USING (estudio_id = public.current_estudio_id());

CREATE POLICY "Estudio members insert liquidaciones"
  ON public.liquidaciones FOR INSERT
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Estudio members update liquidaciones"
  ON public.liquidaciones FOR UPDATE
  USING (estudio_id = public.current_estudio_id())
  WITH CHECK (estudio_id = public.current_estudio_id());