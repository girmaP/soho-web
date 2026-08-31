-- Ejecutar una sola vez en Supabase > SQL Editor antes de desplegar.
alter table public.business_settings
  add column if not exists default_wait_minutes integer not null default 10;

update public.business_settings
set default_wait_minutes = 10,
    updated_at = now()
where id = 'main';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'business_settings_default_wait_minutes_check'
  ) then
    alter table public.business_settings
      add constraint business_settings_default_wait_minutes_check
      check (default_wait_minutes between 5 and 180);
  end if;
end $$;
