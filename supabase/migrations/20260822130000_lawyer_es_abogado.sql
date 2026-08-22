-- Week 2C: the treatment in section IX splits on two axes, not one.
--
-- The source demanda writes "la Dra. María Victoria Iñurrieta y/o Sr. Lautaro
-- Moyano y/o Sr. Matias Prusso": Iñurrieta is a female LAWYER, the other two are
-- men who are not lawyers. Género alone cannot tell Dr. from Sr., so a male
-- lawyer would have printed as "Sr." (Fran, 2026-08-22).
--
--   abogado + F -> Dra.      abogado + M -> Dr.
--      otro + F -> Sra.         otro + M -> Sr.
--
-- Defaults to false because that is the conservative error: addressing a lawyer
-- as "Sr." is a discourtesy, addressing a non-lawyer as "Dr." misstates a
-- professional qualification in a court filing.

ALTER TABLE public.lawyer_profiles
  ADD COLUMN es_abogado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.lawyer_profiles.es_abogado IS
  'Together with genero, picks the treatment (Dr./Dra./Sr./Sra.) when this person is listed among the autorizados of an escrito.';

-- get_estudio_members() carries the fields the autorizados list needs, so it
-- gains this one too. Return type changes, so DROP + CREATE (and re-GRANT).
DROP FUNCTION IF EXISTS public.get_estudio_members();

CREATE FUNCTION public.get_estudio_members()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ,
  nombre TEXT,
  genero TEXT,
  es_abogado BOOLEAN
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
         lp.genero,
         COALESCE(lp.es_abogado, false) AS es_abogado
  FROM public.estudio_members em
  JOIN auth.users u ON u.id = em.user_id
  LEFT JOIN public.lawyer_profiles lp ON lp.user_id = em.user_id
  WHERE em.estudio_id = public.current_estudio_id()
  ORDER BY (em.role = 'head') DESC, em.joined_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_estudio_members() TO authenticated;
