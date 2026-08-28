-- The honorario base becomes a free amount instead of one of two fixed types.
--
-- 3.5 / 7 came from the source mockup, never from a recorded decision, and the
-- firm regulates fees case by case. The UI now defaults to 7 JUS and lets it be
-- typed over.
--
-- Nothing else moves: honorarios_with_balance and honorario_gross_cap() already
-- derive every figure from monto_total_jus, so the ×1.31 gross cap, the pago
-- ceiling trigger and /honorarios keep working untouched (decision #30).
--
-- The 15 rows currently at 3.5 stay exactly as they are — a free amount makes
-- them valid, so no row is rewritten and no collection ceiling shifts.

begin;

do $$
declare
  n35 integer;
  n7 integer;
  otros integer;
begin
  select count(*) filter (where monto_total_jus = 3.5),
         count(*) filter (where monto_total_jus = 7),
         count(*) filter (where monto_total_jus not in (3.5, 7))
    into n35, n7, otros
    from public.honorarios
   where archived_at is null;
  raise notice 'honorarios: % a 3.5 JUS, % a 7 JUS, % con otro monto', n35, n7, otros;
end $$;

ALTER TABLE public.honorarios DROP CONSTRAINT IF EXISTS honorarios_tipo_jus_check;

-- Still not free-for-all: a zero or negative honorario is not a fee, and the
-- gross cap it feeds would let a pago of any size through.
ALTER TABLE public.honorarios ADD CONSTRAINT honorarios_monto_total_jus_positivo
  CHECK (monto_total_jus > 0);

commit;
