
INSERT INTO public.bcra_tasas (anio, mes, tna) VALUES
  (2026, 'FEBRERO', 86.87),
  (2026, 'MARZO',   87.6),
  (2026, 'ABRIL',   87.6),
  (2026, 'MAYO',    86.14),
  (2026, 'JUNIO',   84.68)
ON CONFLICT (anio, mes) DO UPDATE SET tna = EXCLUDED.tna;