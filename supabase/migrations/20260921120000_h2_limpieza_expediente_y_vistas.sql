-- H2 — lo que el import trajo de más, lo que sigue escrito en la taquigrafía del
-- estudio, y las dos vistas que nunca filtraron por estudio.
--
-- Medido el 2026-09-21 contra la base entera (los tres estudios: el real
-- `0260ef43` y los dos de prueba). Los números de cada paso son de esa medición
-- y están en `moya-shipped-log.md`.
--
-- NADA SE BORRA. La decisión #3 del proyecto es soft delete y todas las FK a
-- `ejecutados` son ON DELETE CASCADE — un `delete` se llevaría el honorario, sus
-- pagos, los cobros, las liquidaciones, los escritos y los codemandados. El
-- bloque 5b del diagnóstico devolvió 0 filas vacías sin hijos, así que la fila
-- "que nunca fue real" no existe: todo lo de acá abajo es `archived_at`.
--
-- Las filas que se archivan van por LISTA EXPLÍCITA DE IDS, nunca por predicado,
-- y cada una está decidida a mano con Fran contra el bloque 5c. Lo único que va
-- por predicado es lo que se puede decir en una frase sin nombrar una fila:
-- "un honorario de un ejecutado archivado se archiva", "el texto del juzgado es
-- el nombre oficial del juzgado vinculado".
--
-- Los pasos, y por qué están en este orden:
--
--   1. `numero_expediente_original`, antes de reescribir nada.
--   2. `btrim(nombre)` — 31 filas entraron con un espacio al borde.
--   3. La causa 826 pierde documento y domicilio si no se copian ANTES de
--      archivar a su gemela (el DNI y el domicilio se imprimen en la demanda).
--   4. Los 9 duplicados + el caso sin número de expediente.
--   5. Los honorarios de todo ejecutado archivado — los 8 históricos más los 10
--      de arriba. Archivar un ejecutado NO archiva su honorario: `/inicio` y
--      `/honorarios` leen honorarios por su propio `archived_at`, y por eso 8
--      casos terminados seguían sumando en el pendiente.
--   6. El juzgado como texto libre pasa al nombre oficial del organismo.
--   7. El expediente queda en la causa sola.
--   8. Las 4 formas `causa/año` que el detector de dudosos marcaba de más.
--   9. Las dos vistas pasan a `security_invoker`.
--
-- LO QUE NO ESTÁ ACÁ, A PROPÓSITO:
--
--   * La causa 13017. Es el único par donde las dos mitades tienen un pago de
--     honorarios, y NO son el mismo pago: $100.000 el 24/08/2026 (1,88 JUS) en
--     la mitad borrador y $100.000 el 28/08/2026 (2,26 JUS) en la que queda.
--     Archivar la borrador se llevaría plata cobrada de la vista, así que queda
--     como está hasta que Fran decida si son dos cobros o uno cargado dos veces.
--   * Las causas 44247, 55782 y 126947. Las dos primeras son personas distintas
--     en ciudades distintas (los números de causa se reinician por juzgado); la
--     tercera son dos personas con el mismo expediente en el mismo juzgado, que
--     es un dato mal cargado y no una fila duplicada. Fran: "dejalos y los miro
--     después".
--   * Los 5 expedientes dudosos que no son de las 4 contestadas: el único que
--     queda es `CCC` (sin ningún número), y se archiva en el paso 4 en vez de
--     reescribirse.
--   * `create_default_honorario()`. Un borrador tiene honorario y los 7 JUS por
--     defecto están bien (Fran, 2026-09-21). No se toca.
--   * Una columna de año. El año del expediente es cuándo inició la causa, no
--     parte del identificador; queda recuperable en `numero_expediente_original`.
--
-- Esta migración es idempotente y, sobre una base nueva, un no-op: los ids no
-- existen y los UPDATE no encuentran fila. Por eso no lleva ningún guard que
-- levante excepción (gotcha #50: un guard que afirma el número equivocado aborta
-- la migración entera). El bloque final sólo imprime NOTICEs.

begin;

-- ---------------------------------------------------------------------------
-- 1. El valor previo del expediente, antes de tocarlo
-- ---------------------------------------------------------------------------
-- Una columna es el precio de poder deshacer una decisión equivocada. Guarda el
-- string tal cual estaba en las filas que el paso 7 u 8 reescriben, y queda NULL
-- en todas las demás — incluidas las que ya estaban en forma canónica.
ALTER TABLE public.ejecutados
  ADD COLUMN IF NOT EXISTS numero_expediente_original TEXT;

COMMENT ON COLUMN public.ejecutados.numero_expediente_original IS
  'El numero_expediente tal como lo trajo el sistema viejo (DEPTO-causa-año, causa/año), sólo en las filas que H2 reescribió a la causa sola. NULL = nunca se reescribió. Es de donde se recupera el año de inicio de causa si alguna vez hace falta.';

-- ---------------------------------------------------------------------------
-- 2. Los nombres con un espacio al borde — 31 filas
-- ---------------------------------------------------------------------------
-- El espacio no se ve en pantalla y sí rompe cualquier agrupación por nombre:
-- "ORTIZ HECTOR " y "ORTIZ HECTOR" son la misma persona y dos claves distintas.
UPDATE public.ejecutados
   SET nombre = btrim(nombre)
 WHERE nombre <> btrim(nombre);

-- ---------------------------------------------------------------------------
-- 3. Causa 826: copiar lo que sólo tiene la gemela, ANTES de archivarla
-- ---------------------------------------------------------------------------
-- La fila que queda es la de los 2 pagos de honorarios (decisión de Fran) y
-- llegó pelada: sin documento y sin domicilio. La que se archiva trae los dos y
-- se lleva además sus 4 escritos, que es lo que Fran eligió a sabiendas.
-- Sólo se escribe donde el destino está vacío: esto no pisa ningún dato.
UPDATE public.ejecutados dst
   SET documento = CASE WHEN btrim(coalesce(dst.documento, '')) = ''
                        THEN src.documento ELSE dst.documento END,
       domicilio = CASE WHEN btrim(coalesce(dst.domicilio, '')) = ''
                        THEN src.domicilio ELSE dst.domicilio END
  FROM public.ejecutados src
 WHERE dst.id = 'ba42b2df-f889-53cd-82bb-02b260c1406f'
   AND src.id = '68c0f622-f84a-43f5-8f9c-d676c37c8e45';

-- ---------------------------------------------------------------------------
-- 4. Las 10 filas que se archivan
-- ---------------------------------------------------------------------------
-- 9 mitades de par duplicado y 1 caso sin número de expediente. En cada par
-- queda la fila con datos colgando (documento, escritos, pagos, codemandado) y
-- se archiva la pelada; donde las dos son idénticas queda la que ya está en
-- forma canónica o la del nombre completo.
UPDATE public.ejecutados
   SET archived_at = now()
 WHERE archived_at IS NULL
   AND id IN (
     '9f91ffdb-47b9-5dd4-b9a1-5eb2ce931d9e',  -- causa 752    · era borrador
     '68c0f622-f84a-43f5-8f9c-d676c37c8e45',  -- causa 826    · queda la de los 2 pagos
     'b23e3b06-8364-5b53-95c7-76f880d56218',  -- causa 3760   · la otra tiene documento, un pago y 4 escritos
     '906ef2f5-3e67-557e-84bc-d2771186d854',  -- causa 18960  · gemelas idénticas
     '7c5e4b86-64c3-49fb-8e29-72f6b404e644',  -- causa 25965  · queda la del JCYC Nº14, con el codemandado
     'e8047dfe-8a4a-53fc-9108-1d6621e003cb',  -- causa 37052  · la otra tiene un escrito
     '04726f26-e0ce-5b3d-807e-ca689649d9f3',  -- causa 38387  · queda la del nombre completo
     '49be0d5e-ab3e-537f-8851-4d6e547f87d0',  -- causa 50649  · ésta no tiene ni liquidación
     '5a02e908-5c1c-585d-8d92-77c0a4204a8e',  -- causa 70637  · queda la del nombre completo
     '142a5500-1e94-5ac9-8653-d10e4261a843'   -- expediente "CCC", sin ningún número
   );

-- ---------------------------------------------------------------------------
-- 5. El honorario de un ejecutado archivado se archiva con él
-- ---------------------------------------------------------------------------
-- 18 filas: los 8 que ya estaban así (7 de ellos con plata cobrada, sumando en
-- el pendiente de /inicio como si fueran cola de trabajo) y los 10 del paso 4.
-- Va por predicado porque la regla se dice en una frase y no nombra ninguna fila.
UPDATE public.honorarios h
   SET archived_at = now()
  FROM public.ejecutados e
 WHERE e.id = h.ejecutado_id
   AND e.archived_at IS NOT NULL
   AND h.archived_at IS NULL;

-- ---------------------------------------------------------------------------
-- 6. El juzgado: del texto libre del estudio al nombre oficial del organismo
-- ---------------------------------------------------------------------------
-- 428 filas. El mismo juzgado estaba escrito de hasta tres formas — `JCYC Nº2`,
-- `Civil y Comercial N° 2`, y las variantes que difieren sólo en la ordinal
-- masculina `º` (U+00BA) contra el símbolo de grado `°` (U+00B0), dos caracteres
-- que en pantalla se ven casi iguales.
--
-- `replace(organismo, 'º', '°')` es el espejo EXACTO de formatOrganismo()
-- (`lib/data/juzgados.ts`), que es lo que imprime el convenio y la demanda: así
-- la pantalla y el documento dicen la misma cadena. Si aquella función cambia,
-- esto queda viejo — pero es un backfill de una vez, no una regla viva.
--
-- Los 12 activos sin `juzgado_id` no se tocan: su texto libre es el único
-- asidero que tiene Fran para reconocerlos.
UPDATE public.ejecutados e
   SET juzgado = replace(j.organismo, 'º', '°')
  FROM public.juzgados j
 WHERE j.id = e.juzgado_id
   AND e.juzgado IS DISTINCT FROM replace(j.organismo, 'º', '°');

-- ---------------------------------------------------------------------------
-- 7. El expediente queda en la causa y nada más
-- ---------------------------------------------------------------------------
-- 86 filas, todas con año adentro. `TD-1436-2021` y `1436/2021` pasan a `1436`.
-- El año no es parte del identificador: es cuándo inició la causa (Fran,
-- 2026-09-21), y queda recuperable en numero_expediente_original.
--
-- La forma canónica la produce normalizeNumeroExpediente() en cada guardado, así
-- que una vez reescritas las filas el desorden no puede volver por la UI.
--
-- El SQL de abajo es el espejo de extractCausa() (`lib/domain/mail-match.ts`):
-- sacar un prefijo de 2-3 letras seguido del número, tomar la PRIMERA corrida de
-- dígitos si tiene 7 o menos, y quitarle los ceros a la izquierda. Verificado
-- fila por fila contra la función real sobre las 433 filas de la base:
-- 0 desacuerdos.
--
-- Y por eso mismo la cláusula NOT: extractCausa toma la PRIMERA corrida, así que
-- `OL-2021-111` parsearía como causa 2021. Todo lo que huela a eso — primer
-- número con forma de año, más de tres grupos numéricos, o ningún dígito — queda
-- afuera y se resuelve a mano. Es el predicado del bloque 7b del diagnóstico, y
-- se deja puesto para el próximo import aunque hoy sólo atrape 5 filas.
WITH candidatas AS (
  SELECT e.id,
         e.numero_expediente,
         -- El prefijo se saca conservando lo que lo seguía (\1) en vez de con un
         -- lookahead: la misma semántica, sin depender de una construcción que
         -- no todas las versiones de Postgres tratan igual.
         (regexp_match(
            regexp_replace(e.numero_expediente, '^[A-Za-z]{2,3}([[:space:]-]*[0-9])', '\1'),
            '[0-9]+'))[1] AS primera_corrida
    FROM public.ejecutados e
   WHERE btrim(coalesce(e.numero_expediente, '')) <> ''
     AND (regexp_match(e.numero_expediente, '[0-9]{1,7}'))[1] !~ '^(19|20)[0-9]{2}$'
     AND array_length(regexp_split_to_array(e.numero_expediente, '[^0-9]+'), 1) <= 3
     AND e.numero_expediente ~ '[0-9]'
),
canonicas AS (
  SELECT id,
         numero_expediente,
         coalesce(nullif(regexp_replace(primera_corrida, '^0+', ''), ''), primera_corrida) AS causa
    FROM candidatas
   WHERE primera_corrida IS NOT NULL
     AND length(primera_corrida) <= 7
)
UPDATE public.ejecutados e
   SET numero_expediente = c.causa,
       numero_expediente_original = e.numero_expediente
  FROM canonicas c
 WHERE c.id = e.id
   AND e.numero_expediente <> c.causa;

-- ---------------------------------------------------------------------------
-- 8. Las 4 `causa/año` que el detector marcaba de más
-- ---------------------------------------------------------------------------
-- Falsos positivos del predicado de arriba: son `causa/año` donde la causa cae
-- en el rango de los años. Fran, 2026-09-21: "el primero es siempre la causa".
-- Cada UPDATE lleva el valor actual en el WHERE, así que si la fila ya cambió
-- no hace nada en vez de escribir sobre otra cosa.
UPDATE public.ejecutados SET numero_expediente_original = numero_expediente, numero_expediente = '1942'
 WHERE id = '9016748b-83ef-5f81-a958-adfb5272ea76' AND numero_expediente = '1942/2025';
UPDATE public.ejecutados SET numero_expediente_original = numero_expediente, numero_expediente = '1960'
 WHERE id = 'e31823e2-c804-564e-8197-acd55dd281e5' AND numero_expediente = '1960/2019';
UPDATE public.ejecutados SET numero_expediente_original = numero_expediente, numero_expediente = '2013'
 WHERE id = '66f172ff-d1f2-5433-9342-65ff78e1f7cb' AND numero_expediente = '2013/2024';
UPDATE public.ejecutados SET numero_expediente_original = numero_expediente, numero_expediente = '2056'
 WHERE id = '3b3c954f-e52d-4673-8170-b65e862bf9dd' AND numero_expediente = '2056/2019';

-- ---------------------------------------------------------------------------
-- 9. Las dos vistas pasan a security_invoker
-- ---------------------------------------------------------------------------
-- Una vista creada sin `security_invoker` se ejecuta con los permisos de su
-- DUEÑO, que acá es el mismo rol que creó las tablas — y el dueño de una tabla
-- no pasa por su propia RLS. O sea que `honorarios_with_balance` y
-- `cobros_totals` venían devolviendo LOS TRES ESTUDIOS a cualquier usuario
-- autenticado, sin importar la política de `honorarios`, `cobros_pagos` ni
-- `ejecutados`.
--
-- Eso es lo que hacía que /honorarios mostrara 425 filas y 102 sin nombre: la
-- vista traía los 433 honorarios de la base, el embed de `ejecutados` sí
-- respetaba RLS y volvía NULL para los 102 de los otros dos estudios, y la
-- pantalla imprimía "—" donde iba el nombre. Los $193.899.507 de "Honorarios
-- pendientes" de /inicio y los totales de /cobros son del mismo origen: suman
-- los tres estudios.
--
-- Con esto la RLS se evalúa para quien consulta. Lo que cambia en pantalla son
-- los números, y pasan a ser los del estudio de uno: /honorarios 425 -> 313
-- filas y ninguna en blanco, /inicio y /cobros dejan de sumar lo ajeno. El
-- service_role (los scripts de `scripts/`) sigue viendo todo, porque bypassea
-- RLS por su cuenta.
ALTER VIEW public.honorarios_with_balance SET (security_invoker = on);
ALTER VIEW public.cobros_totals SET (security_invoker = on);

-- ---------------------------------------------------------------------------
-- Lo que quedó, en el log del push. NOTICEs, nunca una excepción: sobre una base
-- nueva todos estos números son 0 y eso está bien.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  ejecutados_archivados  integer;
  honorarios_archivados  integer;
  honorarios_vivos       integer;
  expedientes_reescritos integer;
  con_juzgado_raro       integer;
  dudosos                integer;
BEGIN
  SELECT count(*) INTO ejecutados_archivados FROM public.ejecutados WHERE archived_at IS NOT NULL;
  SELECT count(*) INTO honorarios_archivados FROM public.honorarios WHERE archived_at IS NOT NULL;
  SELECT count(*) INTO honorarios_vivos      FROM public.honorarios WHERE archived_at IS NULL;
  SELECT count(*) INTO expedientes_reescritos FROM public.ejecutados WHERE numero_expediente_original IS NOT NULL;
  SELECT count(*) INTO con_juzgado_raro
    FROM public.ejecutados e JOIN public.juzgados j ON j.id = e.juzgado_id
   WHERE e.juzgado IS DISTINCT FROM replace(j.organismo, 'º', '°');
  SELECT count(*) INTO dudosos
    FROM public.ejecutados
   WHERE btrim(coalesce(numero_expediente, '')) <> ''
     AND ( (regexp_match(numero_expediente, '[0-9]{1,7}'))[1] ~ '^(19|20)[0-9]{2}$'
        OR array_length(regexp_split_to_array(numero_expediente, '[^0-9]+'), 1) > 3
        OR numero_expediente !~ '[0-9]' );

  RAISE NOTICE 'H2 — ejecutados archivados: %', ejecutados_archivados;
  RAISE NOTICE 'H2 — honorarios archivados: % / vivos: %', honorarios_archivados, honorarios_vivos;
  RAISE NOTICE 'H2 — expedientes reescritos (con original guardado): %', expedientes_reescritos;
  RAISE NOTICE 'H2 — filas con juzgado_id cuyo texto NO es el organismo: % (esperado 0)', con_juzgado_raro;
  RAISE NOTICE 'H2 — expedientes dudosos sin reescribir: % (esperado 1: el "CCC", ya archivado)', dudosos;
END $$;

commit;
