
CREATE TABLE public.ejecutados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Case identification
  nombre TEXT NOT NULL,
  juzgado TEXT NOT NULL DEFAULT '',
  departamento TEXT NOT NULL DEFAULT '',
  numero_expediente TEXT NOT NULL DEFAULT '',

  -- Financial state
  deuda_inicial NUMERIC NOT NULL DEFAULT 0,
  liquidacion NUMERIC, 

  -- Workflow
  movimiento TEXT CHECK (movimiento IN (
    'Inicio Causa',
    'Enviar Cédula',
    'Enviar Mandamiento',
    'Pedir Sentencia'
    'En Cobro'
  )),
  observaciones TEXT NOT NULL DEFAULT '',

  -- Lifecycle
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ejecutados_estudio ON public.ejecutados(estudio_id) WHERE archived_at IS NULL;
CREATE INDEX idx_ejecutados_estudio_archived ON public.ejecutados(estudio_id, archived_at);
CREATE INDEX idx_ejecutados_nombre ON public.ejecutados USING gin (to_tsvector('spanish', nombre));

ALTER TABLE public.ejecutados ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_ejecutados_updated_at
  BEFORE UPDATE ON public.ejecutados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
CREATE POLICY "Estudio members read ejecutados"
  ON public.ejecutados FOR SELECT
  USING (estudio_id = public.current_estudio_id());

CREATE POLICY "Estudio members insert ejecutados"
  ON public.ejecutados FOR INSERT
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Estudio members update ejecutados"
  ON public.ejecutados FOR UPDATE
  USING (estudio_id = public.current_estudio_id())
  WITH CHECK (estudio_id = public.current_estudio_id());
