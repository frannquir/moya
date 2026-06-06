-- Link an ejecutado to its real court. Nullable + ON DELETE SET NULL so existing
-- rows (and cases whose court isn't in the table) are unaffected. The denormalized
-- ejecutados.departamento / juzgado text columns stay for the board + back-compat.

ALTER TABLE public.ejecutados
  ADD COLUMN juzgado_id UUID REFERENCES public.juzgados(id) ON DELETE SET NULL;

CREATE INDEX idx_ejecutados_juzgado ON public.ejecutados(juzgado_id) WHERE juzgado_id IS NOT NULL;
