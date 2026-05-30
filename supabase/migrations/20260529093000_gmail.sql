-- Gmail (Mail feature) — OAuth connect substrate.
-- One Gmail inbox per estudio: the head links it, members never link their own.
-- Refresh tokens are encrypted (AES-256-GCM) before storage - lib/gmail/crypto.ts.

-- Short-lived CSRF tokens for the OAuth round-trip. Only the service-role admin
-- client (connect + callback routes) touches this table, so RLS is enabled with
-- no policies (denies all authenticated access; service role bypasses RLS).
CREATE TABLE public.gmail_oauth_states (
  state TEXT PRIMARY KEY,
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_oauth_states ENABLE ROW LEVEL SECURITY;

-- One connection per estudio. The OAuth callback writes tokens via the
-- service-role admin client (bypasses RLS); the policies below govern in-app
-- reads and head-driven changes (disconnect / clear sync error).
CREATE TABLE public.gmail_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL UNIQUE REFERENCES public.estudios(id) ON DELETE CASCADE,
  connected_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  google_email TEXT NOT NULL,
  access_token TEXT,                        -- short-lived; refreshed by the sync
  refresh_token_encrypted TEXT NOT NULL,    -- AES-256-GCM, format "ivB64:ciphertextB64"
  token_expires_at TIMESTAMPTZ,
  scope TEXT NOT NULL DEFAULT '',
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_gmail_connections_updated_at
  BEFORE UPDATE ON public.gmail_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Members read estudio gmail connection"
  ON public.gmail_connections FOR SELECT
  USING (estudio_id = public.current_estudio_id());

CREATE POLICY "Head updates estudio gmail connection"
  ON public.gmail_connections FOR UPDATE
  USING (estudio_id = public.current_estudio_id() AND public.is_current_user_head())
  WITH CHECK (estudio_id = public.current_estudio_id() AND public.is_current_user_head());

CREATE POLICY "Head deletes estudio gmail connection"
  ON public.gmail_connections FOR DELETE
  USING (estudio_id = public.current_estudio_id() AND public.is_current_user_head());
