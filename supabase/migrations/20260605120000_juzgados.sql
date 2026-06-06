-- juzgados: global reference table of Buenos Aires courts (SCBA Guía Judicial),
-- refreshed monthly by scripts/import-juzgados.ts. Shared across all estudios
-- (no estudio_id), read-only to authenticated users; only the service-role
-- import writes. `fuente` (the SCBA idrep URL) is the stable upsert key, so
-- monthly refreshes update rows in place and ejecutados.juzgado_id stays valid.

CREATE TABLE public.juzgados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  departamento_judicial TEXT NOT NULL,
  organismo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'Juzgado Civil y Comercial',
    'Juzgado de Paz',
    'Receptoria de Expedientes'
  )),
  fuero TEXT NOT NULL DEFAULT '',
  numero INT,

  direccion TEXT NOT NULL DEFAULT '',
  localidad TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  juez TEXT NOT NULL DEFAULT '',
  internos TEXT[] NOT NULL DEFAULT '{}',

  fuente TEXT NOT NULL UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_juzgados_depto_tipo ON public.juzgados(departamento_judicial, tipo, numero);
CREATE INDEX idx_juzgados_tipo ON public.juzgados(tipo);

ALTER TABLE public.juzgados ENABLE ROW LEVEL SECURITY;

-- Reference data: any authenticated user can read it (mirrors escritos_templates).
CREATE POLICY "Authenticated read juzgados"
  ON public.juzgados FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_juzgados_updated_at
  BEFORE UPDATE ON public.juzgados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
