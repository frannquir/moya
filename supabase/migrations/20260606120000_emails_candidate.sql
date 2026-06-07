

ALTER TABLE public.emails
  ADD COLUMN candidate_ejecutado_id UUID REFERENCES public.ejecutados(id) ON DELETE SET NULL;

CREATE INDEX idx_emails_candidate ON public.emails(candidate_ejecutado_id)
  WHERE archived_at IS NULL AND candidate_ejecutado_id IS NOT NULL;
