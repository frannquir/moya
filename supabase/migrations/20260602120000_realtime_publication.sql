-- Enable Supabase Realtime for the two surfaces that get live updates.
-- RLS still applies to realtime payloads (locked decision #3: estudio_id RLS on all domain
-- tables), so a user only receives changes to rows they can SELECT.
ALTER PUBLICATION supabase_realtime ADD TABLE public.emails;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ejecutados;
