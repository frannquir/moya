
CREATE TABLE public.facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  pago_id UUID NOT NULL REFERENCES public.cobros_pagos(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  mensaje_generado TEXT NOT NULL DEFAULT '',
  confirmada BOOLEAN NOT NULL DEFAULT false,
  fecha_generada TIMESTAMPTZ NOT NULL DEFAULT now(),

  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(pago_id)
);

CREATE INDEX idx_facturas_estudio
  ON public.facturas(estudio_id) WHERE archived_at IS NULL;
CREATE INDEX idx_facturas_pago
  ON public.facturas(pago_id) WHERE archived_at IS NULL;

ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_facturas_updated_at
  BEFORE UPDATE ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Estudio members read facturas"
  ON public.facturas FOR SELECT
  USING (estudio_id = public.current_estudio_id());

CREATE POLICY "Estudio members insert facturas"
  ON public.facturas FOR INSERT
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Estudio members update facturas"
  ON public.facturas FOR UPDATE
  USING (estudio_id = public.current_estudio_id())
  WITH CHECK (estudio_id = public.current_estudio_id());