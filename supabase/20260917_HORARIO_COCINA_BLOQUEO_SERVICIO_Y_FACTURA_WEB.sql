-- SOHO Cambados · ajustes finales de producción
-- 1) Horario de cocina independiente (mediodía + noche)
-- 2) Inicio de servicio fijado al 17/09/2026 y bloqueado
-- 3) Facturación web correlativa F-WEB-0001, F-WEB-0002, ...

alter table public.business_settings
  add column if not exists kitchen_hours jsonb;

update public.business_settings
set kitchen_hours = coalesce(kitchen_hours, jsonb_build_object(
  '1', jsonb_build_object('closed', false, 'lunch', jsonb_build_object('open','13:00','close','16:00','enabled',true), 'dinner', jsonb_build_object('open','20:00','close','23:30','enabled',true)),
  '2', jsonb_build_object('closed', false, 'lunch', jsonb_build_object('open','13:00','close','16:00','enabled',true), 'dinner', jsonb_build_object('open','20:00','close','23:30','enabled',true)),
  '3', jsonb_build_object('closed', false, 'lunch', jsonb_build_object('open','13:00','close','16:00','enabled',true), 'dinner', jsonb_build_object('open','20:00','close','23:30','enabled',true)),
  '4', jsonb_build_object('closed', false, 'lunch', jsonb_build_object('open','13:00','close','16:00','enabled',true), 'dinner', jsonb_build_object('open','20:00','close','23:30','enabled',true)),
  '5', jsonb_build_object('closed', false, 'lunch', jsonb_build_object('open','13:00','close','16:00','enabled',true), 'dinner', jsonb_build_object('open','20:00','close','23:30','enabled',true)),
  '6', jsonb_build_object('closed', false, 'lunch', jsonb_build_object('open','13:00','close','16:00','enabled',true), 'dinner', jsonb_build_object('open','20:00','close','23:30','enabled',true)),
  '0', jsonb_build_object('closed', false, 'lunch', jsonb_build_object('open','13:00','close','16:00','enabled',true), 'dinner', jsonb_build_object('open','20:00','close','23:30','enabled',true))
))
where id = 'main';

alter table public.business_settings
  alter column kitchen_hours set default '{}'::jsonb;

-- Inicio contractual del periodo incluido: 17/09/2026.
update public.business_settings
set service_start_date = date '2026-09-17'
where id = 'main';

create or replace function public.lock_service_start_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.service_start_date is not null
     and new.service_start_date is distinct from old.service_start_date then
    new.service_start_date := old.service_start_date;
  end if;
  return new;
end;
$$;

drop trigger if exists business_settings_lock_service_start_date on public.business_settings;
create trigger business_settings_lock_service_start_date
before update of service_start_date
on public.business_settings
for each row
execute function public.lock_service_start_date();

-- Serie única y correlativa para facturas procedentes de la web.
create table if not exists public.invoice_web_counter (
  id smallint primary key default 1 check (id = 1),
  last_number integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.invoice_web_counter (id, last_number)
values (1, 0)
on conflict (id) do nothing;

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number integer;
begin
  if new.invoice_requested = true
     and new.payment_status = 'paid'
     and new.invoice_number is null then

    update public.invoice_web_counter
    set last_number = last_number + 1,
        updated_at = now()
    where id = 1
    returning last_number into v_number;

    new.invoice_number := format('F-WEB-%s', lpad(v_number::text, 4, '0'));
  end if;

  return new;
end;
$$;

drop trigger if exists orders_assign_invoice_number on public.orders;
create trigger orders_assign_invoice_number
before insert or update of invoice_requested, payment_status, paid_at
on public.orders
for each row
execute function public.assign_invoice_number();

notify pgrst, 'reload schema';
