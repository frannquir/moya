-- Two more cédula-reissue templates get a clave so the pinned layer
-- (lib/domain/escritos-pinned.ts) can name them. They were seeded already
-- (20260525134035) tagged Enviar Cédula + diligenciada=false but with no
-- clave, so they never surfaced: gotcha #31, templates are referenced by
-- clave, never by título. Fran confirmed 2026-09-24 these belong in the same
-- pinned set as the other cédula-reissue escritos, for the case where the
-- address itself — not the timing or the liability waiver — was the problem.

UPDATE public.escritos_templates SET clave = 'cumple-intimacion-nuevo-domicilio'
  WHERE titulo = 'Cumple intimación – Denuncia nuevo domicilio';
UPDATE public.escritos_templates SET clave = 'cumple-intimacion-domicilio-laboral'
  WHERE titulo = 'Cumple intimación – Domicilio laboral';
