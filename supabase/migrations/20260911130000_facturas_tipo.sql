-- Which of the two messages a factura is, as a stored choice rather than a
-- derivation.
--
-- 20260911120000 inferred the message from where the money sat: a cobro meant
-- pacto cuota litis, a fee payment meant Factura B. That is right most of the
-- time and wrong often enough to matter — COFRE's cobro of $424.800,25 carries
-- the nota "honorarios solicitados", and under a derived type it could only ever
-- ask Tartan for 15% of money that was already fees.
--
-- Decision (Fran, 2026-09-11): stop inferring. Every payment opens on cuota
-- litis and the lawyer flips it to Factura B when it is one. One predictable
-- default beats a clever rule that is silently wrong on the exceptions.
--
-- The SOURCE columns are untouched and still say where the money is; `tipo` only
-- says which message was written about it. They are independent on purpose: that
-- separation is what lets a cobro carry a Factura B.

begin;

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'cuota-litis';

ALTER TABLE public.facturas DROP CONSTRAINT IF EXISTS facturas_tipo_check;
ALTER TABLE public.facturas ADD CONSTRAINT facturas_tipo_check
  CHECK (tipo IN ('cuota-litis', 'factura-b'));

COMMENT ON COLUMN public.facturas.tipo IS
  'Which message was generated: cuota-litis (15% to the empresa) or factura-b (the fee, to the debtor by DNI). Independent of pago_id/honorario_pago_id, which say where the money came from.';

do $$
declare
  n integer;
begin
  select count(*) into n from public.facturas;
  raise notice 'facturas existentes, todas a cuota-litis por defecto: %', n;
end $$;

commit;
