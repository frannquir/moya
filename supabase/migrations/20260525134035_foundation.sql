CREATE TABLE public.estudios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_estudios_owner ON public.estudios(owner_user_id);

ALTER TABLE public.estudios ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.estudio_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('head', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(estudio_id, user_id),
  UNIQUE(user_id) 
);

CREATE INDEX idx_estudio_members_estudio ON public.estudio_members(estudio_id);

ALTER TABLE public.estudio_members ENABLE ROW LEVEL SECURITY;


CREATE OR REPLACE FUNCTION public.current_estudio_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT estudio_id FROM public.estudio_members WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_head()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.estudio_members
    WHERE user_id = auth.uid() AND role = 'head'
  )
$$;

GRANT EXECUTE ON FUNCTION public.current_estudio_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_head() TO authenticated;


CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_estudios_updated_at
  BEFORE UPDATE ON public.estudios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Members read their estudio"
  ON public.estudios FOR SELECT
  USING (id = public.current_estudio_id());

CREATE POLICY "Head updates own estudio"
  ON public.estudios FOR UPDATE
  USING (id = public.current_estudio_id() AND public.is_current_user_head())
  WITH CHECK (id = public.current_estudio_id() AND public.is_current_user_head());

CREATE POLICY "Members read own estudio members"
  ON public.estudio_members FOR SELECT
  USING (estudio_id = public.current_estudio_id());

CREATE POLICY "Head inserts members"
  ON public.estudio_members FOR INSERT
  WITH CHECK (estudio_id = public.current_estudio_id() AND public.is_current_user_head());

CREATE POLICY "Head deletes members"
  ON public.estudio_members FOR DELETE
  USING (estudio_id = public.current_estudio_id() AND public.is_current_user_head());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_estudio_id UUID;
BEGIN
  INSERT INTO public.estudios (nombre, owner_user_id)
  VALUES (split_part(NEW.email, '@', 1) || '''s estudio', NEW.id)
  RETURNING id INTO new_estudio_id;

  INSERT INTO public.estudio_members (estudio_id, user_id, role)
  VALUES (new_estudio_id, NEW.id, 'head');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.lawyer_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  matricula TEXT NOT NULL DEFAULT '',
  cuit TEXT NOT NULL DEFAULT '',
  legajo TEXT NOT NULL DEFAULT '',
  ibm TEXT NOT NULL DEFAULT '',
  domicilio_electronico TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  iva_condicion TEXT NOT NULL DEFAULT 'Responsable Inscripto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lawyer_profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_lawyer_profiles_updated_at
  BEFORE UPDATE ON public.lawyer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "User reads own profile"
  ON public.lawyer_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Head reads member profiles"
  ON public.lawyer_profiles FOR SELECT
  USING (
    public.is_current_user_head()
    AND user_id IN (
      SELECT em.user_id FROM public.estudio_members em
      WHERE em.estudio_id = public.current_estudio_id()
    )
  );

CREATE POLICY "User inserts own profile"
  ON public.lawyer_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "User updates own profile"
  ON public.lawyer_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read system_config"
  ON public.system_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

INSERT INTO public.system_config (key, value)
VALUES ('jus_config', '{"value": 44330, "date": "2025-10-01"}'::jsonb);

CREATE TABLE public.bcra_tasas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anio INT NOT NULL,
  mes TEXT NOT NULL,
  tna NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(anio, mes)
);

CREATE INDEX idx_bcra_tasas_anio_mes ON public.bcra_tasas(anio, mes);

ALTER TABLE public.bcra_tasas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read bcra_tasas"
  ON public.bcra_tasas FOR SELECT
  USING (auth.uid() IS NOT NULL);