-- Carpetas de ejecutados (package G, section G2).
--
-- A user files ejecutados into named folders of their own. One case can sit in
-- several folders (carpeta_ejecutados), and each folder has a colour key and a
-- position. The head can SHARE a folder with a member, and sharing a folder
-- shares the cases inside it. That is a third way into public.ejecutados, next
-- to "the head sees the whole estudio" and "a member sees what is delegated to
-- them". So this migration changes the RLS of ejecutados, and of the three
-- tables that repeat its delegation overlay: codemandados, movimiento_historial
-- and emails.
--
-- Decisions (Fran, 2026-09-25). This is the explicit decision that locked
-- decision #24 asks for before the delegation pattern spreads:
--   1. A share gives READ and WRITE. carpeta_shares.puede_editar exists, defaults
--      to true and is honoured by every UPDATE path below, so closing a share to
--      read-only later is a data change, not a migration.
--   2. Only the HEAD shares. Anyone can create folders, and a member's folders
--      are private. The helpers also require the folder's owner to be the head
--      at read time, so a share stops working if its owner stops being head, and
--      access can never be passed along a chain of shares.
--   3. The child tables follow the share. codemandados can be read, and written
--      when the share edits. Without it, a demanda generated on a shared case
--      prints without its codemandados. movimiento_historial can be read. emails
--      can be read, and updated when the share edits.
--   4. A share only adds access. It never changes assigned_to_user_id, and
--      removing the share restores exactly the access there was before. Only the
--      head can change the assignee. A trigger enforces that now, because the
--      shared path lets a member UPDATE a row that is not assigned to them, and
--      a WITH CHECK cannot compare the new row against the old one.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- `color` is a palette KEY, not a colour. lib/domain/carpetas.ts maps it to
-- --carpeta-* tokens, the way MOVIMIENTO_ETAPA maps a stage to --mov-*, so dark
-- mode and a re-theme never have to touch a stored row.
CREATE TABLE public.carpetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  -- The owner. NULL only if the auth user is deleted, and then no one owns the
  -- folder, so its shares grant nothing.
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'gris',
  -- Position among the owner's own folders, ascending.
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT carpetas_nombre_check CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 60),
  CONSTRAINT carpetas_color_check CHECK (color IN ('gris', 'azul', 'turquesa', 'verde', 'ambar', 'naranja', 'rojo', 'violeta')),
  -- Target of the composite foreign keys below, which keep a link or a share
  -- inside the folder's own estudio.
  CONSTRAINT carpetas_id_estudio_key UNIQUE (id, estudio_id)
);

CREATE INDEX idx_carpetas_owner
  ON public.carpetas(estudio_id, created_by_user_id) WHERE archived_at IS NULL;

-- Two active folders with the same name for the same owner would be two chips
-- that cannot be told apart.
CREATE UNIQUE INDEX idx_carpetas_nombre_unico
  ON public.carpetas(created_by_user_id, lower(btrim(nombre))) WHERE archived_at IS NULL;

-- The same composite-key trick for ejecutados: (id) is already the primary key,
-- so (id, estudio_id) is trivially unique. It lets carpeta_ejecutados prove,
-- declaratively, that a case and its folder belong to the same estudio.
ALTER TABLE public.ejecutados
  ADD CONSTRAINT ejecutados_id_estudio_key UNIQUE (id, estudio_id);

CREATE TABLE public.carpeta_ejecutados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  carpeta_id UUID NOT NULL,
  ejecutado_id UUID NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Taking a case out of a folder archives the link. Filing it again brings the
  -- same row back, which is why the UNIQUE below covers archived rows too.
  archived_at TIMESTAMPTZ,
  CONSTRAINT carpeta_ejecutados_unico UNIQUE (carpeta_id, ejecutado_id),
  CONSTRAINT carpeta_ejecutados_carpeta_fkey
    FOREIGN KEY (carpeta_id, estudio_id)
    REFERENCES public.carpetas(id, estudio_id) ON DELETE CASCADE,
  CONSTRAINT carpeta_ejecutados_ejecutado_fkey
    FOREIGN KEY (ejecutado_id, estudio_id)
    REFERENCES public.ejecutados(id, estudio_id) ON DELETE CASCADE
);

CREATE INDEX idx_carpeta_ejecutados_ejecutado
  ON public.carpeta_ejecutados(ejecutado_id) WHERE archived_at IS NULL;

CREATE TABLE public.carpeta_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  carpeta_id UUID NOT NULL,
  -- The member the folder is shared WITH.
  user_id UUID NOT NULL,
  puede_editar BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Unsharing archives the row, and sharing again brings it back.
  archived_at TIMESTAMPTZ,
  CONSTRAINT carpeta_shares_unico UNIQUE (carpeta_id, user_id),
  CONSTRAINT carpeta_shares_carpeta_fkey
    FOREIGN KEY (carpeta_id, estudio_id)
    REFERENCES public.carpetas(id, estudio_id) ON DELETE CASCADE,
  -- The recipient has to be a member of the folder's estudio. CASCADE, not
  -- RESTRICT, so removing a member from the estudio is never blocked by a share.
  CONSTRAINT carpeta_shares_miembro_fkey
    FOREIGN KEY (estudio_id, user_id)
    REFERENCES public.estudio_members(estudio_id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_carpeta_shares_user
  ON public.carpeta_shares(user_id) WHERE archived_at IS NULL;

CREATE TRIGGER trg_carpetas_updated_at
  BEFORE UPDATE ON public.carpetas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_carpeta_ejecutados_updated_at
  BEFORE UPDATE ON public.carpeta_ejecutados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_carpeta_shares_updated_at
  BEFORE UPDATE ON public.carpeta_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.carpetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpeta_ejecutados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpeta_shares ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER, like current_estudio_id() and is_current_user_head(): the
-- policies below call these to read the carpeta tables, and the carpeta tables'
-- own policies read each other. Read through RLS, that loop is "infinite
-- recursion detected in policy". A definer function reads the rows directly, and
-- Postgres does not expand a function body when it expands a policy.
--
-- STABLE, with no per-row argument, and called as `id IN (SELECT helper(...))`:
-- the planner runs it once per statement as a hashed subplan, instead of once
-- for every row of ejecutados.
--
-- Both apply the same four conditions: the share and the folder are active, the
-- recipient is the current user in their current estudio, and the folder's
-- owner is the HEAD of that estudio right now.

-- The ejecutados reachable through a folder shared with the current user. With
-- p_para_editar = true, only the shares that allow editing count.
CREATE OR REPLACE FUNCTION public.ejecutados_compartidos_conmigo(p_para_editar BOOLEAN)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
ROWS 50
AS $$
  SELECT DISTINCT ce.ejecutado_id
    FROM public.carpeta_shares s
    JOIN public.carpetas c
      ON c.id = s.carpeta_id
     AND c.estudio_id = s.estudio_id
     AND c.archived_at IS NULL
    JOIN public.estudio_members owner
      ON owner.user_id = c.created_by_user_id
     AND owner.estudio_id = c.estudio_id
     AND owner.role = 'head'
    JOIN public.carpeta_ejecutados ce
      ON ce.carpeta_id = c.id
     AND ce.archived_at IS NULL
   WHERE s.user_id = auth.uid()
     AND s.estudio_id = public.current_estudio_id()
     AND s.archived_at IS NULL
     AND (s.puede_editar OR NOT p_para_editar)
$$;

-- The folders shared with the current user, so they can see the folder itself.
CREATE OR REPLACE FUNCTION public.carpetas_compartidas_conmigo()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
ROWS 10
AS $$
  SELECT s.carpeta_id
    FROM public.carpeta_shares s
    JOIN public.carpetas c
      ON c.id = s.carpeta_id
     AND c.estudio_id = s.estudio_id
     AND c.archived_at IS NULL
    JOIN public.estudio_members owner
      ON owner.user_id = c.created_by_user_id
     AND owner.estudio_id = c.estudio_id
     AND owner.role = 'head'
   WHERE s.user_id = auth.uid()
     AND s.estudio_id = public.current_estudio_id()
     AND s.archived_at IS NULL
$$;

GRANT EXECUTE ON FUNCTION public.ejecutados_compartidos_conmigo(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.carpetas_compartidas_conmigo() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. RLS on the carpeta tables
-- ---------------------------------------------------------------------------
-- No DELETE policies anywhere: soft delete via archived_at (locked decision #3).

-- A folder is visible to its owner and to the members it is shared with. The
-- head does NOT see a member's private folders, and does not need to: the head
-- already sees every case in them.
CREATE POLICY "Owner and share recipients read carpetas"
  ON public.carpetas FOR SELECT
  USING (
    estudio_id = public.current_estudio_id()
    AND (
      created_by_user_id = auth.uid()
      OR id IN (SELECT public.carpetas_compartidas_conmigo())
    )
  );

CREATE POLICY "Members create their own carpetas"
  ON public.carpetas FOR INSERT
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
  );

-- Rename, recolour, reorder and archive belong to the owner alone. A recipient
-- works the cases inside the folder, not the folder itself.
CREATE POLICY "Owner updates carpetas"
  ON public.carpetas FOR UPDATE
  USING (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
  )
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
  );

-- A folder's contents are visible to whoever can see the folder. The subquery
-- goes through the carpetas policy above.
CREATE POLICY "Read the contents of visible carpetas"
  ON public.carpeta_ejecutados FOR SELECT
  USING (
    estudio_id = public.current_estudio_id()
    AND carpeta_id IN (SELECT id FROM public.carpetas)
  );

-- Only the owner files cases, and only cases the owner can see. The ejecutados
-- subquery goes through the ejecutados policy, so a member cannot file a case
-- they could not open.
CREATE POLICY "Owner files visible ejecutados"
  ON public.carpeta_ejecutados FOR INSERT
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND created_by_user_id = auth.uid()
    AND carpeta_id IN (
      SELECT id FROM public.carpetas
       WHERE created_by_user_id = auth.uid() AND archived_at IS NULL
    )
    AND ejecutado_id IN (SELECT id FROM public.ejecutados)
  );

-- Taking a case out (archived_at set) must work even for a case the owner can no
-- longer see, for example one the head has since delegated elsewhere. Putting a
-- case back needs the same visibility as filing it.
CREATE POLICY "Owner updates carpeta contents"
  ON public.carpeta_ejecutados FOR UPDATE
  USING (
    estudio_id = public.current_estudio_id()
    AND carpeta_id IN (
      SELECT id FROM public.carpetas WHERE created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND carpeta_id IN (
      SELECT id FROM public.carpetas WHERE created_by_user_id = auth.uid()
    )
    AND (
      archived_at IS NOT NULL
      OR ejecutado_id IN (SELECT id FROM public.ejecutados)
    )
  );

-- The owner sees who a folder is shared with. A recipient sees their own share
-- row, which is how the UI knows whether the share allows editing.
CREATE POLICY "Owner and recipient read carpeta_shares"
  ON public.carpeta_shares FOR SELECT
  USING (
    estudio_id = public.current_estudio_id()
    AND (
      user_id = auth.uid()
      OR carpeta_id IN (
        SELECT id FROM public.carpetas WHERE created_by_user_id = auth.uid()
      )
    )
  );

-- Only the head shares (decision 2), only their own active folders, and never
-- with themselves.
CREATE POLICY "Head shares own carpetas"
  ON public.carpeta_shares FOR INSERT
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND public.is_current_user_head()
    AND created_by_user_id = auth.uid()
    AND user_id <> auth.uid()
    AND carpeta_id IN (
      SELECT id FROM public.carpetas
       WHERE created_by_user_id = auth.uid() AND archived_at IS NULL
    )
  );

CREATE POLICY "Head updates shares of own carpetas"
  ON public.carpeta_shares FOR UPDATE
  USING (
    estudio_id = public.current_estudio_id()
    AND public.is_current_user_head()
    AND carpeta_id IN (
      SELECT id FROM public.carpetas WHERE created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND public.is_current_user_head()
    AND user_id <> auth.uid()
    AND carpeta_id IN (
      SELECT id FROM public.carpetas WHERE created_by_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. ejecutados: the third way in
-- ---------------------------------------------------------------------------
-- Before this migration (20260603120000):
--   estudio_id = current_estudio_id()
--   AND (is_current_user_head() OR assigned_to_user_id = auth.uid())
-- INSERT is unchanged: a share never lets anyone create a case.

DROP POLICY "Estudio members read ejecutados" ON public.ejecutados;
CREATE POLICY "Estudio members read ejecutados"
  ON public.ejecutados FOR SELECT
  USING (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR assigned_to_user_id = auth.uid()
      OR id IN (SELECT public.ejecutados_compartidos_conmigo(false))
    )
  );

-- The shared branch requires a share that allows editing. The WITH CHECK keeps
-- the row in the estudio. The assignee is protected by the trigger below: the
-- WITH CHECK cannot compare the new row with the old one, and without the
-- trigger a member with a shared folder could reassign any case in it.
DROP POLICY "Estudio members update ejecutados" ON public.ejecutados;
CREATE POLICY "Estudio members update ejecutados"
  ON public.ejecutados FOR UPDATE
  USING (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR assigned_to_user_id = auth.uid()
      OR id IN (SELECT public.ejecutados_compartidos_conmigo(true))
    )
  )
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR assigned_to_user_id = auth.uid()
      OR id IN (SELECT public.ejecutados_compartidos_conmigo(true))
    )
  );

-- Only the head moves a case between people. Before this migration the old
-- WITH CHECK already made that true for members. The shared path is what needs
-- the trigger. auth.uid() is NULL outside a user session (migrations, scripts,
-- the service role), and those are not restricted.
CREATE OR REPLACE FUNCTION public.ejecutados_solo_head_reasigna()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_current_user_head() THEN
    RAISE EXCEPTION 'Only the head can change who an ejecutado is assigned to'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ejecutados_solo_head_reasigna
  BEFORE UPDATE OF assigned_to_user_id ON public.ejecutados
  FOR EACH ROW
  WHEN (OLD.assigned_to_user_id IS DISTINCT FROM NEW.assigned_to_user_id)
  EXECUTE FUNCTION public.ejecutados_solo_head_reasigna();

-- ---------------------------------------------------------------------------
-- 5. The tables that mirror the overlay follow the share (decision 3)
-- ---------------------------------------------------------------------------
-- Each keeps its existing clauses word for word and gains the shared ids: the
-- read set for SELECT, and the editable set for writes.

DROP POLICY "Estudio members read codemandados" ON public.codemandados;
CREATE POLICY "Estudio members read codemandados"
  ON public.codemandados FOR SELECT
  USING (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
      OR ejecutado_id IN (SELECT public.ejecutados_compartidos_conmigo(false))
    )
  );

DROP POLICY "Estudio members insert codemandados" ON public.codemandados;
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
      OR ejecutado_id IN (SELECT public.ejecutados_compartidos_conmigo(true))
    )
  );

DROP POLICY "Estudio members update codemandados" ON public.codemandados;
CREATE POLICY "Estudio members update codemandados"
  ON public.codemandados FOR UPDATE
  USING (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
      OR ejecutado_id IN (SELECT public.ejecutados_compartidos_conmigo(true))
    )
  )
  WITH CHECK (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
      OR ejecutado_id IN (SELECT public.ejecutados_compartidos_conmigo(true))
    )
  );

DROP POLICY "Estudio members read movimiento_historial" ON public.movimiento_historial;
CREATE POLICY "Estudio members read movimiento_historial"
  ON public.movimiento_historial FOR SELECT
  USING (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
      OR ejecutado_id IN (SELECT public.ejecutados_compartidos_conmigo(false))
    )
  );

DROP POLICY "Read estudio emails" ON public.emails;
CREATE POLICY "Read estudio emails"
  ON public.emails FOR SELECT
  USING (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
      OR candidate_ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
      OR ejecutado_id IN (SELECT public.ejecutados_compartidos_conmigo(false))
      OR candidate_ejecutado_id IN (SELECT public.ejecutados_compartidos_conmigo(false))
    )
  );

-- WITH CHECK stays estudio-wide, as 20260607120000 left it (Fran's call then:
-- the head reassigns mail across members).
DROP POLICY "Update estudio emails" ON public.emails;
CREATE POLICY "Update estudio emails"
  ON public.emails FOR UPDATE
  USING (
    estudio_id = public.current_estudio_id()
    AND (
      public.is_current_user_head()
      OR ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
      OR candidate_ejecutado_id IN (
        SELECT id FROM public.ejecutados WHERE assigned_to_user_id = auth.uid()
      )
      OR ejecutado_id IN (SELECT public.ejecutados_compartidos_conmigo(true))
      OR candidate_ejecutado_id IN (SELECT public.ejecutados_compartidos_conmigo(true))
    )
  )
  WITH CHECK (
    estudio_id = public.current_estudio_id()
  );

-- ---------------------------------------------------------------------------
-- 6. Guard
-- ---------------------------------------------------------------------------
-- Structural, not a count, so it holds on any database (gotcha #50). It aborts
-- the migration if either helper lost SECURITY DEFINER or STABLE, if RLS is off
-- on a carpeta table, or if a policy that is supposed to carry the shared path
-- does not.
DO $$
DECLARE
  fn RECORD;
  missing TEXT;
BEGIN
  FOR fn IN
    SELECT p.proname, p.prosecdef, p.provolatile
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('ejecutados_compartidos_conmigo', 'carpetas_compartidas_conmigo')
  LOOP
    IF NOT fn.prosecdef OR fn.provolatile <> 's' THEN
      RAISE EXCEPTION '% must be SECURITY DEFINER and STABLE', fn.proname;
    END IF;
  END LOOP;

  SELECT string_agg(c.relname, ', ') INTO missing
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('carpetas', 'carpeta_ejecutados', 'carpeta_shares')
     AND NOT c.relrowsecurity;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is off on %', missing;
  END IF;

  SELECT string_agg(tablename || '/' || policyname, ', ') INTO missing
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (tablename, policyname) IN (
       ('ejecutados', 'Estudio members read ejecutados'),
       ('ejecutados', 'Estudio members update ejecutados'),
       ('codemandados', 'Estudio members read codemandados'),
       ('codemandados', 'Estudio members insert codemandados'),
       ('codemandados', 'Estudio members update codemandados'),
       ('movimiento_historial', 'Estudio members read movimiento_historial'),
       ('emails', 'Read estudio emails'),
       ('emails', 'Update estudio emails')
     )
     AND coalesce(qual, with_check) NOT LIKE '%ejecutados_compartidos_conmigo%';
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Policies without the shared path: %', missing;
  END IF;

  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename IN ('ejecutados', 'codemandados', 'movimiento_historial', 'emails')
         AND coalesce(qual, with_check) LIKE '%ejecutados_compartidos_conmigo%') <> 8 THEN
    RAISE EXCEPTION 'Expected exactly 8 policies carrying the shared path';
  END IF;
END $$;
