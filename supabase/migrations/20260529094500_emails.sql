-- emails: estudio-scoped store for synced Gmail messages, auto-matched to
-- ejecutados by expediente number. Written by the gmail-sync Edge Function via
-- the service-role client; read by members, re-assignable by members.

CREATE TABLE public.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  gmail_connection_id UUID REFERENCES public.gmail_connections(id) ON DELETE SET NULL,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT,
  from_email TEXT NOT NULL DEFAULT '',
  from_name TEXT NOT NULL DEFAULT '',
  to_emails TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ,
  gmail_labels TEXT[] NOT NULL DEFAULT '{}',
  ejecutado_id UUID REFERENCES public.ejecutados(id) ON DELETE SET NULL,
  match_confidence NUMERIC NOT NULL DEFAULT 0,
  match_manual BOOLEAN NOT NULL DEFAULT false,
  -- true for Mesa de Entrada Virtual (mev@scba.gov.ar) mail, which is shared with
  -- every estudio member; all other mail stays visible to the head only.
  is_delegated BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotent sync: a Gmail message lands at most once per estudio.
  UNIQUE (estudio_id, gmail_message_id)
);

CREATE INDEX idx_emails_ejecutado ON public.emails(ejecutado_id) WHERE archived_at IS NULL;
CREATE INDEX idx_emails_received ON public.emails(estudio_id, received_at DESC) WHERE archived_at IS NULL;

ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Members see delegated (MEV) mail; the head sees all of the estudio's mail.
CREATE POLICY "Read estudio emails by delegation"
  ON public.emails FOR SELECT
  USING (
    estudio_id = public.current_estudio_id()
    AND (is_delegated OR public.is_current_user_head())
  );

-- Re-assign an email to an ejecutado (manual match), only on rows you can see.
CREATE POLICY "Update estudio emails by delegation"
  ON public.emails FOR UPDATE
  USING (
    estudio_id = public.current_estudio_id()
    AND (is_delegated OR public.is_current_user_head())
  )
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND (is_delegated OR public.is_current_user_head())
  );

-- Now that emails exists, enforce the propose/confirm provenance FK that
-- ejecutado_eventos.mail_id was holding as a bare UUID.
ALTER TABLE public.ejecutado_eventos
  ADD CONSTRAINT ejecutado_eventos_mail_id_fkey
  FOREIGN KEY (mail_id) REFERENCES public.emails(id) ON DELETE SET NULL;
