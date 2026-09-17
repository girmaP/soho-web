-- SOHO Cambados · fija y bloquea la fecha de inicio del servicio.
-- Inicio acordado: 17/09/2026.
-- Los 3 meses incluidos terminan el 17/12/2026.

update public.business_settings
set service_start_date = date '2026-09-17'
where id = 'main';

create or replace function public.prevent_service_start_date_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.id = 'main'
     and old.service_start_date is not null
     and new.service_start_date is distinct from old.service_start_date then
    raise exception 'La fecha de inicio del servicio está bloqueada y no se puede modificar.';
  end if;

  return new;
end;
$$;

drop trigger if exists business_settings_lock_service_start_date
on public.business_settings;

create trigger business_settings_lock_service_start_date
before update of service_start_date
on public.business_settings
for each row
execute function public.prevent_service_start_date_change();

notify pgrst, 'reload schema';
