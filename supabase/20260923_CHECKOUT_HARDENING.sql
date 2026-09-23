-- SOHO Cambados · endurecimiento de checkout y consistencia final (23/09/2026)
-- Compatible con pedidos programados hasta 7 días y con la serie F-WEB.

-- Un pedido puede hacerse horas antes de la apertura de cocina. El límite
-- anterior de 180 minutos hacía fallar el INSERT aunque la hora fuese válida.
alter table public.orders
  drop constraint if exists orders_estimated_time_check;

alter table public.orders
  add constraint orders_estimated_time_check
  check (estimated_time is null or estimated_time between 5 and 10080);

-- Garantiza que las columnas finales existen aunque las migraciones se hayan
-- aplicado en distinto orden.
alter table public.business_settings
  add column if not exists kitchen_hours jsonb not null default '{}'::jsonb;

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

-- Esta tabla es interna; no debe ser accesible desde cliente.
alter table public.invoice_web_counter enable row level security;
revoke all on public.invoice_web_counter from anon, authenticated;
grant all on public.invoice_web_counter to service_role;

-- Las funciones de trigger no forman parte de la API pública. Si una instalación
-- antigua todavía no tiene alguna, no hacemos fallar esta migración por ello.
do $migration$
begin
  if to_regprocedure('public.assign_invoice_number()') is not null then
    execute 'revoke all on function public.assign_invoice_number() from public';
  end if;
  if to_regprocedure('public.lock_service_start_date()') is not null then
    execute 'revoke all on function public.lock_service_start_date() from public';
  end if;
end $migration$;

-- La vista de diagnóstico debe respetar los permisos del invocador.
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
  to_regclass('public.business_settings') is not null as business_settings_ok;

revoke all on public.soho_production_schema_check from anon, authenticated;
grant select on public.soho_production_schema_check to service_role;

notify pgrst, 'reload schema';
