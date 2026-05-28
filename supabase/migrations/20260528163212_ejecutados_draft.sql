-- A "borrador" is an ejecutado in draft state. No separate table.
ALTER TABLE public.ejecutados
  ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_ejecutados_estudio_draft
  ON public.ejecutados(estudio_id, is_draft) WHERE archived_at IS NULL;