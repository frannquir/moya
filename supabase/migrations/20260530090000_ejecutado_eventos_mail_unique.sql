-- Mail-derived events are inserted by the gmail-sync function every time the
-- classifier finds a match. The 3-day sync window overlaps daily, so the same
-- email can be processed across multiple runs — this constraint keeps a single
-- (mail, tipo_evento) pair from accumulating duplicates.
--
-- nulls are distinct in Postgres UNIQUE constraints, so this only dedupes
-- mail-derived events (mail_id IS NOT NULL); manual events with mail_id = NULL
-- are unaffected.
ALTER TABLE public.ejecutado_eventos
  ADD CONSTRAINT ejecutado_eventos_mail_event_unique
  UNIQUE (mail_id, tipo_evento);
