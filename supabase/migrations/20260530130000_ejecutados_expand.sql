
ALTER TABLE public.ejecutados
  ADD COLUMN codemandados TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN documento TEXT NOT NULL DEFAULT '',
  ADD COLUMN domicilio TEXT NOT NULL DEFAULT '',
  ADD COLUMN practica_liquidacion DATE,
  ADD COLUMN dinero_en_cuenta NUMERIC,
  ADD COLUMN medida_cautelar_nota TEXT NOT NULL DEFAULT '',
  ADD COLUMN medida_cautelar_estado TEXT CHECK (medida_cautelar_estado IN ('Solicitada','Proveída')),
  ADD COLUMN medida_cautelar_diligenciada BOOLEAN NOT NULL DEFAULT false;


ALTER TABLE public.ejecutados DROP COLUMN IF EXISTS liquidacion;
ALTER TABLE public.ejecutados RENAME COLUMN diligenciada TO movimiento_diligenciada;

CREATE OR REPLACE FUNCTION public.set_ejecutado_practica_liquidacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.ejecutados
     SET practica_liquidacion = NEW.created_at::date
   WHERE id = NEW.ejecutado_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_liquidaciones_practica_date
  AFTER INSERT ON public.liquidaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_ejecutado_practica_liquidacion();
