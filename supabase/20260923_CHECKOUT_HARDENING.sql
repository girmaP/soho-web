-- SOHO Cambados · endurecimiento de checkout y consistencia final (23/09/2026)
-- Idempotente: no elimina pedidos, productos, horarios ni usuarios.

-- 1. Pedidos programados ------------------------------------------------------
-- El checkout puede aceptar pedidos horas antes de abrir cocina. El límite
-- anterior de 180 min hacía fallar el INSERT para una recogida válida.
alter table public.orders
  drop constraint if exists orders_estimated_time_check;

alter table public.orders
  add constraint orders_estimated_time_check
  check (estimated_time is null or estimated_time between 5 and 10080);

-- 2. Esquema final de cocina/facturación -------------------------------------
alter table public.business_settings
  add column if not exists kitchen_hours jsonb not null default '{}'::jsonb;

alter table public.business_settings
  add column if not exists service_start_date date;

alter table public.orders
  add column if not exists invoice_number text;

create unique index if not exists orders_invoice_number_unique
  on public.orders(invoice_number)
  where invoice_number is not null;

create table if not exists public.invoice_web_counter (
  id smallint primary key default 1 check (id = 1),
  last_number integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.invoice_web_counter(id,last_number)
values(1,0)
on conflict(id) do nothing;

-- 3. Serie correlativa F-WEB --------------------------------------------------
create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path=public
as $body$
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
$body$;

revoke all on function public.assign_invoice_number() from public;

drop trigger if exists orders_assign_invoice_number on public.orders;
create trigger orders_assign_invoice_number
before insert or update of invoice_requested,payment_status,paid_at
on public.orders
for each row
execute function public.assign_invoice_number();

-- 4. Fecha contractual bloqueada ---------------------------------------------
update public.business_settings
set service_start_date = coalesce(service_start_date, date '2026-09-17')
where id = 'main';

create or replace function public.lock_service_start_date()
returns trigger
language plpgsql
security definer
set search_path=public
as $body$
begin
  if old.service_start_date is not null
     and new.service_start_date is distinct from old.service_start_date then
    new.service_start_date := old.service_start_date;
  end if;
  return new;
end;
$body$;

revoke all on function public.lock_service_start_date() from public;

drop trigger if exists business_settings_lock_service_start_date
on public.business_settings;

create trigger business_settings_lock_service_start_date
before update of service_start_date
on public.business_settings
for each row
execute function public.lock_service_start_date();

-- 5. Seguridad de la tabla interna de numeración -----------------------------
alter table public.invoice_web_counter enable row level security;
revoke all on public.invoice_web_counter from anon,authenticated;
grant all on public.invoice_web_counter to service_role;

-- 6. Vista de diagnóstico sin privilegios del propietario --------------------
drop view if exists public.soho_production_schema_check;
create view public.soho_production_schema_check
with (security_invoker = true)
as
select
  to_regclass('public.orders') is not null as orders_ok,
  to_regclass('public.order_items') is not null as order_items_ok,
  to_regclass('public.stripe_webhook_events') is not null as stripe_webhook_events_ok,
  to_regclass('public.order_email_deliveries') is not null as order_email_deliveries_ok,
  to_regclass('public.print_jobs') is not null as print_jobs_ok,
  to_regclass('public.business_settings') is not null as business_settings_ok,
  to_regclass('public.invoice_web_counter') is not null as invoice_web_counter_ok;

revoke all on public.soho_production_schema_check from anon,authenticated;
grant select on public.soho_production_schema_check to service_role;

notify pgrst, 'reload schema';
