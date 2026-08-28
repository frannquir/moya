-- cuenta_honorarios goes from one free-text line to named parts.
--
-- The single box asked for a tipo, a banco, a número, a CBU, a DNI, an alias and
-- a titular at once, so none of it could be validated or reused.
--
-- Measured before this ran: one estudio holds the key, as an empty string, and
-- no estudio holds free text. A non-empty value is therefore not split apart —
-- it is carried verbatim under `texto`, which resolveCuentaHonorarios renders
-- while every part is empty. Pulling a CBU out of prose with a regex is how a
-- wrong account number reaches a court filing.

begin;

do $$
declare
  vacias integer;
  con_texto integer;
begin
  select count(*) into vacias
    from public.estudios
   where jsonb_typeof(escritos_config -> 'cuenta_honorarios') = 'string'
     and btrim(escritos_config ->> 'cuenta_honorarios') = '';

  select count(*) into con_texto
    from public.estudios
   where jsonb_typeof(escritos_config -> 'cuenta_honorarios') = 'string'
     and btrim(escritos_config ->> 'cuenta_honorarios') <> '';

  raise notice 'cuenta_honorarios: % vacías, % con texto', vacias, con_texto;
end $$;

-- Empty strings become empty parts.
update public.estudios
   set escritos_config = jsonb_set(
         escritos_config,
         '{cuenta_honorarios}',
         jsonb_build_object(
           'tipo', '', 'banco', '', 'numero', '',
           'cbu', '', 'alias', '', 'dni', '', 'titular', ''
         )
       )
 where jsonb_typeof(escritos_config -> 'cuenta_honorarios') = 'string'
   and btrim(escritos_config ->> 'cuenta_honorarios') = '';

-- Anything already written stays readable, under `texto`.
update public.estudios
   set escritos_config = jsonb_set(
         escritos_config,
         '{cuenta_honorarios}',
         jsonb_build_object(
           'tipo', '', 'banco', '', 'numero', '',
           'cbu', '', 'alias', '', 'dni', '', 'titular', '',
           'texto', escritos_config ->> 'cuenta_honorarios'
         )
       )
 where jsonb_typeof(escritos_config -> 'cuenta_honorarios') = 'string'
   and btrim(escritos_config ->> 'cuenta_honorarios') <> '';

commit;
