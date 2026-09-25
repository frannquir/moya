-- El octavo CHECK del plan de honorarios: cada cuota vale al menos un centavo
-- (revisión de B1, 2026-09-24).
--
-- 20260923120000 dejó siete CHECK y esta regla afuera. validarPlanHonorarios()
-- la tiene (saldo < cuotas -> error) y planHonorarios() LANZA un RangeError con
-- ese mensaje, pero nada en la base la sostenía: honorarios_plan_anticipo_bajo_techo
-- sólo exige anticipo < techo. Una fila como
--
--   max_acordado_ars = 1000.00, plan_anticipo_ars = 999.95, plan_cuotas = 12
--
-- pasa los siete, deja 5 centavos para 12 cuotas, y planDeFila() -- el único
-- camino documentado de una fila guardada a un cronograma -- tira RangeError sin
-- catch. En un Server Component eso es un 500, no un mensaje.
--
-- El camino realista a esa fila no es que alguien tipee 999,95: es borrar el
-- máximo acordado bajo un plan, que recongela el legal de hoy (caso 3 de
-- setHonorarioMonto, B2). Si ese valor aterriza apenas por encima del anticipo,
-- la base lo acepta. La validación de escritura que lo atajaría es de B2: hasta
-- entonces, esta regla no vivía en ningún lado.
--
-- Va en su propio archivo y no dentro de 20260923120000 porque esa migración ya
-- está aplicada y registrada: `supabase db push` la saltea, así que editarla no
-- haría nada.
--
-- Espeja el dominio al centavo. aCentavos() redondea CADA LADO por separado
-- antes de restar, así que el CHECK hace lo mismo y no redondea la diferencia.
--
-- COALESCE(max_acordado_ars, plan_cap_legal_ars) nunca es NULL cuando hay plan:
-- honorarios_plan_un_techo ya exige exactamente uno de los dos.
--
-- Valida en cero tiempo: ninguna fila tiene plan_cuotas todavía (bloque 5 de
-- B1-verificacion.sql, corrido el 2026-09-24 sobre los tres estudios).

begin;

ALTER TABLE public.honorarios
  DROP CONSTRAINT IF EXISTS honorarios_plan_saldo_por_cuota;

ALTER TABLE public.honorarios
  ADD CONSTRAINT honorarios_plan_saldo_por_cuota
  CHECK (
    plan_cuotas IS NULL
    OR round(COALESCE(max_acordado_ars, plan_cap_legal_ars) * 100)
       - round(COALESCE(plan_anticipo_ars, 0) * 100) >= plan_cuotas
  );

commit;
