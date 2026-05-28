
ALTER TABLE public.estudios
  ADD COLUMN escritos_config JSONB NOT NULL DEFAULT '{}'::jsonb;
