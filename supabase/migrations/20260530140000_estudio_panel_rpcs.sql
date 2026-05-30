
CREATE OR REPLACE FUNCTION public.get_estudio_members()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ,
  nombre TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT em.user_id,
         u.email::text,
         em.role,
         em.joined_at,
         COALESCE(lp.nombre, '') AS nombre
  FROM public.estudio_members em
  JOIN auth.users u ON u.id = em.user_id
  LEFT JOIN public.lawyer_profiles lp ON lp.user_id = em.user_id
  WHERE em.estudio_id = public.current_estudio_id()
  ORDER BY (em.role = 'head') DESC, em.joined_at ASC;
$$;

-- Resolve a registered user by email so the head can add them to the estudio.
-- Head-only: returns nothing for non-heads or unknown emails.
CREATE OR REPLACE FUNCTION public.get_user_by_email(p_email TEXT)
RETURNS TABLE (id UUID, email TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_head() THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT u.id, u.email::text
    FROM auth.users u
    WHERE lower(u.email) = lower(trim(p_email))
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_estudio_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_by_email(TEXT) TO authenticated;

-- Leave-estudio: a non-head member may delete their own membership row. The
-- existing "Head deletes members" policy only covers head-driven removals; this
-- adds the self-leave path while blocking the head from leaving (role = 'member').
CREATE POLICY "Member leaves estudio"
  ON public.estudio_members FOR DELETE
  USING (user_id = auth.uid() AND role = 'member');
