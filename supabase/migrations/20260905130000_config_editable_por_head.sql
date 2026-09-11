-- Let estudio heads maintain the two global reference tables from the UI.
--
-- Both system_config (the JUS value) and bcra_tasas (the monthly TNA) shipped
-- with a SELECT policy and nothing else, so they could only be changed by hand
-- over SQL. The consequence showed up on 2026-09-05: jus_config still held the
-- value seeded in May and bcra_tasas stopped at JUNIO 2026, which silently
-- under-calculates every liquidacion that ends after the last loaded month.
--
-- Decision (Fran, 2026-09-05): a plain RLS policy on is_current_user_head(),
-- not a service-role server action. These tables are GLOBAL -- not scoped by
-- estudio -- so any head can change values every other estudio reads. That is
-- accepted for now: the JUS and the BCRA rates are public figures with one
-- correct value, so the failure mode is a typo, not a leak. If Moya ever hosts
-- estudios that do not trust each other, this is the policy to revisit.

begin;

-- system_config: the JUS value and whatever else lands here later.
DROP POLICY IF EXISTS "Head updates system_config" ON public.system_config;
CREATE POLICY "Head updates system_config"
  ON public.system_config FOR UPDATE
  USING (public.is_current_user_head())
  WITH CHECK (public.is_current_user_head());

-- INSERT as well, so a key that was never seeded can be created instead of
-- failing with a silent zero rows updated.
DROP POLICY IF EXISTS "Head inserts system_config" ON public.system_config;
CREATE POLICY "Head inserts system_config"
  ON public.system_config FOR INSERT
  WITH CHECK (public.is_current_user_head());

-- updated_at defaulted on insert and then never moved, so "last updated" on the
-- config screen would have been the seed date forever.
DROP TRIGGER IF EXISTS trg_system_config_updated_at ON public.system_config;
CREATE TRIGGER trg_system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- bcra_tasas: pasted month by month, upserted on (anio, mes), so both halves of
-- the upsert need a policy. No DELETE -- a rate is corrected, never removed.
DROP POLICY IF EXISTS "Head inserts bcra_tasas" ON public.bcra_tasas;
CREATE POLICY "Head inserts bcra_tasas"
  ON public.bcra_tasas FOR INSERT
  WITH CHECK (public.is_current_user_head());

DROP POLICY IF EXISTS "Head updates bcra_tasas" ON public.bcra_tasas;
CREATE POLICY "Head updates bcra_tasas"
  ON public.bcra_tasas FOR UPDATE
  USING (public.is_current_user_head())
  WITH CHECK (public.is_current_user_head());

commit;
