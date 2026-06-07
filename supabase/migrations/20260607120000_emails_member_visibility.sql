
DROP POLICY "Read estudio emails by delegation" ON public.emails;
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
    )
  );

DROP POLICY "Update estudio emails by delegation" ON public.emails;
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
    )
  )
  WITH CHECK (
    estudio_id = public.current_estudio_id()
  );
