-- escritos: signal vector on ejecutados, global template library,
-- generated documents, and the forward-looking event substrate.

-- empresa is a free clave constrained by the estudio's configured empresas
-- (estudios.escritos_config.empresas), not a DB enum.
ALTER TABLE public.ejecutados
  ADD COLUMN medida_cautelar TEXT CHECK (medida_cautelar IN ('embargo','igb')),
  ADD COLUMN diligenciada    BOOLEAN,
  ADD COLUMN empresa         TEXT;

CREATE TABLE public.escritos_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT '',
  orden INTEGER NOT NULL DEFAULT 0,
  sugerido_movimiento      TEXT[] NOT NULL DEFAULT '{}',
  sugerido_medida_cautelar TEXT[] NOT NULL DEFAULT '{}',
  sugerido_evento          TEXT[] NOT NULL DEFAULT '{}',
  sugerido_diligenciada    BOOLEAN,              
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_escritos_templates_orden
  ON public.escritos_templates(orden) WHERE archived_at IS NULL;

ALTER TABLE public.escritos_templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_escritos_templates_updated_at
  BEFORE UPDATE ON public.escritos_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Authenticated users read escritos_templates"
  ON public.escritos_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TABLE public.escritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  ejecutado_id UUID NOT NULL REFERENCES public.ejecutados(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.escritos_templates(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL DEFAULT '',
  contenido TEXT NOT NULL DEFAULT '',   -- rendered, editable (placeholders filled)
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_escritos_estudio
  ON public.escritos(estudio_id) WHERE archived_at IS NULL;
CREATE INDEX idx_escritos_ejecutado
  ON public.escritos(ejecutado_id) WHERE archived_at IS NULL;

ALTER TABLE public.escritos ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_escritos_updated_at
  BEFORE UPDATE ON public.escritos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Estudio members read escritos"
  ON public.escritos FOR SELECT
  USING (estudio_id = public.current_estudio_id());

CREATE POLICY "Estudio members insert escritos"
  ON public.escritos FOR INSERT
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Estudio members update escritos"
  ON public.escritos FOR UPDATE
  USING (estudio_id = public.current_estudio_id())
  WITH CHECK (estudio_id = public.current_estudio_id());

CREATE TABLE public.ejecutado_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  ejecutado_id UUID NOT NULL REFERENCES public.ejecutados(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,             
  source TEXT NOT NULL DEFAULT 'manual',
  confidence NUMERIC NOT NULL DEFAULT 1,
  mail_id UUID,                          
  aplicado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ejecutado_eventos_ejecutado
  ON public.ejecutado_eventos(ejecutado_id) WHERE aplicado;

ALTER TABLE public.ejecutado_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Estudio members read ejecutado_eventos"
  ON public.ejecutado_eventos FOR SELECT
  USING (estudio_id = public.current_estudio_id());

CREATE POLICY "Estudio members insert ejecutado_eventos"
  ON public.ejecutado_eventos FOR INSERT
  WITH CHECK (estudio_id = public.current_estudio_id());

CREATE POLICY "Estudio members update ejecutado_eventos"
  ON public.ejecutado_eventos FOR UPDATE
  USING (estudio_id = public.current_estudio_id())
  WITH CHECK (estudio_id = public.current_estudio_id());
