-- Head-controlled delegation for ejecutados.
-- Adds a per-user assignee on top of estudio scoping: the head sees/edits every
-- row in the estudio; a non-head member sees/edits only rows delegated to them.
-- Revises locked decision #1 for this table specifically (estudio scoping stays;
-- a delegation dimension is layered on).

ALTER TABLE public.ejecutados
  ADD COLUMN assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_ejecutados_assigned
  ON public.ejecutados(assigned_to_user_id) WHERE archived_at IS NULL;

-- Backfill: each existing case is delegated to its creator, so members keep the
-- cases they made and the head keeps the rest (head sees all regardless).
UPDATE public.ejecutados
   SET assigned_to_user_id = created_by_user_id
 WHERE assigned_to_user_id IS NULL AND created_by_user_id IS NOT NULL;

-- Role-aware RLS. is_current_user_head()/current_estudio_id() are the existing
-- SECURITY DEFINER helpers from the foundation migration.
DROP POLICY "Estudio members read ejecutados" ON public.ejecutados;
CREATE POLICY "Estudio members read ejecutados"
  ON public.ejecutados FOR SELECT
  USING (
    estudio_id = public.current_estudio_id()
    AND (public.is_current_user_head() OR assigned_to_user_id = auth.uid())
  );

DROP POLICY "Estudio members insert ejecutados" ON public.ejecutados;
CREATE POLICY "Estudio members insert ejecutados"
  ON public.ejecutados FOR INSERT
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
    AND (public.is_current_user_head() OR assigned_to_user_id = auth.uid())
  );

-- WITH CHECK forces a non-head's resulting row to stay assigned to themselves,
-- so members cannot delegate to others or un-assign themselves; only the head
-- (who bypasses the assignee clause) can change the assignee.
DROP POLICY "Estudio members update ejecutados" ON public.ejecutados;
CREATE POLICY "Estudio members update ejecutados"
  ON public.ejecutados FOR UPDATE
  USING (
    estudio_id = public.current_estudio_id()
    AND (public.is_current_user_head() OR assigned_to_user_id = auth.uid())
  )
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND (public.is_current_user_head() OR assigned_to_user_id = auth.uid())
  );
