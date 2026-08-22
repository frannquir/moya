-- Week 2C: section IX of the demanda lists the estudio's members by name, with a
-- treatment ("Dra. María …" / "Sr. Lautaro …"). Nothing in lawyer_profiles could
-- derive that, so the profile gains the one missing fact.
--
-- Nullable on purpose: an existing profile genuinely does not say, and a member
-- with no genero is listed by bare name rather than guessed at.

ALTER TABLE public.lawyer_profiles
  ADD COLUMN genero TEXT CHECK (genero IN ('F','M'));

COMMENT ON COLUMN public.lawyer_profiles.genero IS
  'F/M, used only to pick the treatment (Dra./Sr.) when listing autorizados in an escrito. NULL means unknown and prints a bare name.';

-- get_estudio_members() is what builds the autorizados list, so it has to carry
-- genero too. The return type changes, and CREATE OR REPLACE cannot change a
-- function's return type, so this is a DROP + CREATE — which also drops the
-- GRANT, hence the re-grant at the end.
DROP FUNCTION IF EXISTS public.get_estudio_members();

CREATE FUNCTION public.get_estudio_members()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ,
  nombre TEXT,
  genero TEXT
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
         COALESCE(lp.nombre, '') AS nombre,
         lp.genero
  FROM public.estudio_members em
  JOIN auth.users u ON u.id = em.user_id
  LEFT JOIN public.lawyer_profiles lp ON lp.user_id = em.user_id
  WHERE em.estudio_id = public.current_estudio_id()
  ORDER BY (em.role = 'head') DESC, em.joined_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_estudio_members() TO authenticated;
