-- Migración para endurecer una instalación existente de SOHO.
-- Hacer copia de seguridad antes de ejecutar en Supabase SQL Editor.
create extension if not exists pgcrypto;

alter type public.payment_status add value if not exists 'authorized';
alter type public.payment_status add value if not exists 'cancelled';
alter type public.payment_status add value if not exists 'refund_pending';

alter table public.orders add column if not exists customer_email text;
update public.orders set customer_email='pendiente@soho.invalid' where customer_email is null;
alter table public.orders alter column customer_email set not null;
alter table public.orders add column if not exists stripe_refund_id text;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists refunded_at timestamptz;
alter table public.orders add column if not exists archived_at timestamptz;
alter table public.business_settings add column if not exists minimum_order numeric(10,2) not null default 0;

-- Evitar borrado en cascada de ventas. Si ya existe la FK, sustituirla.
do $$ declare cname text; begin
  select tc.constraint_name into cname
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
  where tc.table_schema='public' and tc.table_name='order_items' and tc.constraint_type='FOREIGN KEY' and kcu.column_name='order_id' limit 1;
  if cname is not null then execute format('alter table public.order_items drop constraint %I',cname); end if;
  alter table public.order_items add constraint order_items_order_id_fkey foreign key(order_id) references public.orders(id) on delete restrict;
exception when duplicate_object then null; end $$;

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  event_type text not null, actor_type text not null default 'system', actor_id uuid,
  from_status text, to_status text, stripe_event_id text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.stripe_webhook_events (
  event_id text primary key, event_type text not null, status text not null default 'processing',
  error_message text, created_at timestamptz not null default now(), processed_at timestamptz
);
create index if not exists order_events_order_id_idx on public.order_events(order_id,created_at);

alter table public.order_events enable row level security;
alter table public.stripe_webhook_events enable row level security;

-- Cerrar la lectura pública de pedidos y líneas.
drop policy if exists "Public can read order status with token" on public.orders;
drop policy if exists "Public can read order items with token" on public.order_items;
drop policy if exists "Public can create orders" on public.orders;
drop policy if exists "Public can create order items" on public.order_items;
revoke select,insert,update,delete on public.orders,public.order_items from anon;

-- El backend con service_role crea y consulta pedidos; el navegador anónimo no tiene acceso.
drop policy if exists "Admins can manage orders" on public.orders;
create policy "Admins can manage orders" on public.orders for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "Admins can manage order items" on public.order_items;
create policy "Admins can manage order items" on public.order_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "Admins can read order events" on public.order_events;
create policy "Admins can read order events" on public.order_events for select to authenticated using(public.is_admin());

grant all on public.order_events to authenticated,service_role;
grant all on public.stripe_webhook_events to service_role;
grant select on public.admin_users to authenticated;

-- Eliminar funciones de purga automática si proceden de la versión demo.
drop function if exists public.cleanup_orders_older_than_15_days();

notify pgrst,'reload schema';

-- 2026-07-16: informes, costes operativos y reembolsos explícitos
alter table public.orders add column if not exists stripe_fee_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists refund_reason text;
alter table public.business_settings add column if not exists service_start_date date;
alter table public.business_settings add column if not exists printer_price_per_ticket numeric(10,4) not null default 0;
alter table public.business_settings add column if not exists monthly_management_fee numeric(10,2) not null default 0;
alter table public.business_settings add column if not exists monthly_hosting_fee numeric(10,2) not null default 0;
alter table public.business_settings add column if not exists annual_domain_fee numeric(10,2) not null default 0;
alter table public.business_settings add column if not exists fiscal_name text not null default 'SOHO Cambados';
alter table public.business_settings add column if not exists fiscal_nif text not null default '';
alter table public.business_settings add column if not exists fiscal_address text not null default '';
alter table public.business_settings add column if not exists admin_email text not null default '';
notify pgrst, 'reload schema';
