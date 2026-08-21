-- Demanda data foundation (Week 2A).
--
-- Three things happen here:
--   B1  codemandados becomes a real table - each party carries its own CUIL,
--       domicilio, employment status, employer block and card number, because
--       the medida cautelar section of the demanda is composed from them.
--   B2  ejecutados.codemandados (TEXT[], bare names) is dropped. This is the
--       ONLY destructive migration in the project.
--   B3  ejecutados gains the demanda columns, CUIL first (locked decision #11).


-- ---------------------------------------------------------------------------
-- B1 - public.codemandados
-- ---------------------------------------------------------------------------

CREATE TABLE public.codemandados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  ejecutado_id UUID NOT NULL REFERENCES public.ejecutados(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  orden INTEGER NOT NULL DEFAULT 0,

  nombre TEXT NOT NULL,
  cuil TEXT NOT NULL DEFAULT '',
  domicilio TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',

  -- Employment drives which cautelar fragment this party contributes. NOT NULL
  -- here (unlike ejecutados.trabaja) because every codemandado row from now on
  -- is created through the demanda form, which always asks.
  trabaja BOOLEAN NOT NULL DEFAULT false,
  empleador_nombre TEXT NOT NULL DEFAULT '',
  empleador_cuit TEXT NOT NULL DEFAULT '',
  empleador_domicilio TEXT NOT NULL DEFAULT '',
  empleador_telefono TEXT NOT NULL DEFAULT '',

  -- Per party. cuenta_cliper is shared and lives on the ejecutado.
  tarjeta_cabal TEXT NOT NULL DEFAULT '',

  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The employer block is required when trabaja is true, but that is enforced in
-- the form, not here: a DB constraint would be unsatisfiable for any row created
-- before the employer data is filled in.

CREATE INDEX idx_codemandados_ejecutado
  ON public.codemandados(ejecutado_id, orden) WHERE archived_at IS NULL;
CREATE INDEX idx_codemandados_estudio
  ON public.codemandados(estudio_id) WHERE archived_at IS NULL;

ALTER TABLE public.codemandados ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_codemandados_updated_at
  BEFORE UPDATE ON public.codemandados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS mirrors the ejecutados delegation overlay (decision #24): estudio-scoped,
-- and a non-head member reaches only codemandados of ejecutados assigned to them.
CREATE POLICY "Estudio members read codemandados"
  ON public.codemandados FOR SELECT
  USING (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Estudio members insert codemandados"
  ON public.codemandados FOR INSERT
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
    AND (
      public.is_current_user_head()
      OR ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Estudio members update codemandados"
  ON public.codemandados FOR UPDATE
  USING (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
    )
  );

-- No DELETE policy - soft delete via archived_at (locked decision #3).


-- ---------------------------------------------------------------------------
-- B2 - drop the old array
-- ---------------------------------------------------------------------------
--
-- No backfill. Fran's call 2026-08-20: the ejecutados data is mockup, and the
-- real codemandado data arrives with the production load rather than from these
-- bare names. The original plan (LATERAL unnest ... WITH ORDINALITY into orden)
-- is deliberately not run - the 34 names in the array are discarded.
-- Counts are printed first so the drop is not blind.

DO $$
DECLARE
  filas INTEGER;
  nombres INTEGER;
BEGIN
  SELECT count(*), coalesce(sum(array_length(codemandados, 1)), 0)
    INTO filas, nombres
    FROM public.ejecutados
   WHERE array_length(codemandados, 1) > 0;
  RAISE NOTICE 'codemandados array before drop: % ejecutados carrying % names (discarded)', filas, nombres;
END $$;

ALTER TABLE public.ejecutados DROP COLUMN codemandados;

DO $$
DECLARE
  filas INTEGER;
BEGIN
  SELECT count(*) INTO filas FROM public.codemandados;
  RAISE NOTICE 'codemandados table after migration: % rows', filas;
END $$;


-- ---------------------------------------------------------------------------
-- B3 - demanda columns on public.ejecutados
-- ---------------------------------------------------------------------------

ALTER TABLE public.ejecutados
  ADD COLUMN cuil TEXT NOT NULL DEFAULT '',
  -- Relevant on judicial and extrajudicial cases alike, so it is not gated on via.
  ADD COLUMN telefono TEXT NOT NULL DEFAULT '',
  -- Nullable on purpose: legacy rows genuinely do not know.
  ADD COLUMN trabaja BOOLEAN,
  ADD COLUMN empleador_nombre TEXT NOT NULL DEFAULT '',
  ADD COLUMN empleador_cuit TEXT NOT NULL DEFAULT '',
  ADD COLUMN empleador_domicilio TEXT NOT NULL DEFAULT '',
  ADD COLUMN empleador_telefono TEXT NOT NULL DEFAULT '',
  -- Shared across all parties on the case. Digits only, no dashes.
  ADD COLUMN cuenta_cliper TEXT NOT NULL DEFAULT '',
  -- The demandado's own card. Digits only, no dashes.
  ADD COLUMN tarjeta_cabal TEXT NOT NULL DEFAULT '',
  ADD COLUMN fecha_contrato DATE,
  ADD COLUMN origen TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual','demanda','migracion'));

-- Every pre-existing row came in through scripts/migrate-from-old.ts. The
-- updated_at trigger is disabled around the backfill: /escritos ranks the feed by
-- ejecutados.updated_at (gotcha #38), so touching all 314 rows here would erase
-- when each case was really last edited.
ALTER TABLE public.ejecutados DISABLE TRIGGER trg_ejecutados_updated_at;
UPDATE public.ejecutados SET origen = 'migracion';
ALTER TABLE public.ejecutados ENABLE TRIGGER trg_ejecutados_updated_at;

-- documento is NOT dropped: lib/domain/mail-match.ts and the escritos token
-- layer still read it. The form keeps it in sync from the CUIL on save.
