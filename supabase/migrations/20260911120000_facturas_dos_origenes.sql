-- Facturas stop being a thing that only a cobro can have.
--
-- The firm sends two different messages to its accountant, and until now only
-- one of them had anywhere to live:
--
--   * pacto cuota litis — 15% of a debtor's payment plus IVA, invoiced to the
--     empresa (Tartan / Contar / Promaq). Driven by cobros_pagos.
--   * Factura B — the firm's own fees, invoiced to the debtor by DNI, with the
--     10% aportes broken out under "otros tributos". Driven by honorarios_pagos.
--
-- facturas.pago_id was NOT NULL and referenced cobros_pagos, so there was
-- literally nowhere to store the second message. The observable consequence is
-- already in the data: GERVASSIO's fee payment of $257.102,50 was entered TWICE
-- on 2026-09-10 — once correctly in honorarios_pagos, and once as a cobro of
-- $257.102 that exists only so a factura could be generated against it. That
-- phantom cobro is counted as debt recovered by cobros_totals.
--
-- So the column becomes one of two possible sources rather than the only one.
-- A second table was the alternative and was rejected: the two rows carry the
-- same five fields (mensaje, confirmada, fecha, quién, cuándo) and differ only
-- in what they point at, so duplicating the table would duplicate every query,
-- policy and screen that reads it.

begin;

ALTER TABLE public.facturas
  ALTER COLUMN pago_id DROP NOT NULL;

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS honorario_pago_id UUID
    REFERENCES public.honorarios_pagos(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.facturas.pago_id IS
  'The cobro this factura invoices, for the pacto cuota litis message. NULL when the factura is for a fee payment instead.';
COMMENT ON COLUMN public.facturas.honorario_pago_id IS
  'The fee payment this factura invoices, for the Factura B message. NULL when the factura is for a cobro instead.';

-- Exactly one source, never both and never neither. num_nonnulls() rather than
-- a pair of OR'd IS NULL tests: it says the rule once, in the order a reader
-- expects to find it.
ALTER TABLE public.facturas DROP CONSTRAINT IF EXISTS facturas_un_solo_origen;
ALTER TABLE public.facturas ADD CONSTRAINT facturas_un_solo_origen
  CHECK (num_nonnulls(pago_id, honorario_pago_id) = 1);

-- UNIQUE(pago_id) becomes two partial unique indexes. A plain UNIQUE over a now
-- nullable column would still permit many NULLs, so it would no longer say
-- anything about the honorario side; the partial pair keeps "one factura per
-- payment" true for both kinds.
ALTER TABLE public.facturas DROP CONSTRAINT IF EXISTS facturas_pago_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_pago_unico
  ON public.facturas(pago_id) WHERE pago_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_honorario_pago_unico
  ON public.facturas(honorario_pago_id) WHERE honorario_pago_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_honorario_pago
  ON public.facturas(honorario_pago_id) WHERE archived_at IS NULL;

-- RLS is unchanged and deliberately so: both policies are estudio-scoped with no
-- delegation clause, which is what makes /facturas a firm-wide money screen for
-- the head. The new column points at honorarios_pagos, which is estudio-scoped
-- the same way, so nothing widens.

do $$
declare
  n integer;
begin
  select count(*) into n from public.facturas;
  raise notice 'facturas existentes (todas de cobros, pago_id intacto): %', n;
end $$;

commit;
