-- SOHO Cambados - esquema seguro de producción
-- Ejecutar en un proyecto Supabase nuevo. No crea usuarios ni datos demo.
create extension if not exists pgcrypto;

do $$ begin create type public.order_status as enum ('pending','accepted','preparing','ready','delivered','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_type as enum ('pickup','delivery'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('pending','authorized','paid','failed','cancelled','refund_pending','refunded'); exception when duplicate_object then null; end $$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  sort_order int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), name text not null, description text,
  price numeric(10,2) not null check(price >= 0), category_id uuid references public.categories(id) on delete set null,
  image_url text, available boolean not null default true, estimated_time_category text,
  recommended boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), customer_name text not null, customer_phone text not null,
  customer_email text not null, order_type public.order_type not null default 'pickup', delivery_address text, notes text,
  status public.order_status not null default 'pending', payment_status public.payment_status not null default 'pending',
  payment_method text not null default 'stripe', stripe_session_id text, stripe_payment_intent_id text, stripe_refund_id text,
  cancellation_reason text, order_token text not null default encode(gen_random_bytes(24),'hex'),
  accepted_at timestamptz, paid_at timestamptz, cancelled_at timestamptz, refunded_at timestamptz,
  estimated_time int check(estimated_time between 5 and 180), total_price numeric(10,2) not null check(total_price >= 0),
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null, product_name text not null,
  quantity int not null check(quantity > 0), unit_price numeric(10,2) not null check(unit_price >= 0),
  total_price numeric(10,2) not null check(total_price >= 0)
);
create table if not exists public.order_events (
  id bigint generated always as identity primary key, order_id uuid not null references public.orders(id) on delete restrict,
  event_type text not null, actor_type text not null default 'system', actor_id uuid,
  from_status text, to_status text, stripe_event_id text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.stripe_webhook_events (
  event_id text primary key, event_type text not null, status text not null default 'processing',
  error_message text, created_at timestamptz not null default now(), processed_at timestamptz
);
create table if not exists public.business_settings (
  id text primary key default 'main', opening_time text not null default '09:00', closing_time text not null default '23:30',
  manual_pause boolean not null default false, closed_days int[] not null default '{}', minimum_order numeric(10,2) not null default 0,
  weekly_hours jsonb not null default '{"1":{"open":"09:00","close":"23:30","closed":false},"2":{"open":"09:00","close":"23:30","closed":false},"3":{"open":"09:00","close":"23:30","closed":false},"4":{"open":"09:00","close":"23:30","closed":false},"5":{"open":"09:00","close":"00:30","closed":false},"6":{"open":"09:00","close":"00:30","closed":false},"0":{"open":"09:00","close":"23:30","closed":false}}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(), name text not null, email text, phone text, message text not null,
  read boolean not null default false, read_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create unique index if not exists orders_order_token_key on public.orders(order_token);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_events_order_id_idx on public.order_events(order_id, created_at);
create index if not exists products_category_id_idx on public.products(category_id);

insert into public.business_settings(id) values('main') on conflict(id) do nothing;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admin_users where user_id=auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.submit_contact_message(p_name text,p_email text,p_phone text,p_message text)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid; begin
  if length(trim(p_name)) < 2 or length(trim(p_message)) < 5 then raise exception 'Datos no válidos'; end if;
  insert into public.contact_messages(name,email,phone,message) values(trim(p_name),nullif(trim(p_email),''),nullif(trim(p_phone),''),trim(p_message)) returning id into new_id;
  return new_id;
end $$;
revoke all on function public.submit_contact_message(text,text,text,text) from public;
grant execute on function public.submit_contact_message(text,text,text,text) to anon,authenticated,service_role;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.business_settings enable row level security;
alter table public.contact_messages enable row level security;

revoke all on public.orders,public.order_items,public.order_events,public.stripe_webhook_events from anon;
grant select on public.categories,public.products,public.business_settings to anon,authenticated;
grant all on public.categories,public.products,public.orders,public.order_items,public.order_events,public.business_settings,public.contact_messages to authenticated;
grant select on public.admin_users to authenticated;
grant all on all tables in schema public to service_role;

drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories" on public.categories for select using(true);
drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories" on public.categories for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products for select using(available=true);
drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products" on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Public can read business settings" on public.business_settings;
create policy "Public can read business settings" on public.business_settings for select using(true);
drop policy if exists "Admins can manage business settings" on public.business_settings;
create policy "Admins can manage business settings" on public.business_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row" on public.admin_users for select to authenticated using(user_id=auth.uid());

drop policy if exists "Admins can manage orders" on public.orders;
create policy "Admins can manage orders" on public.orders for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "Admins can manage order items" on public.order_items;
create policy "Admins can manage order items" on public.order_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "Admins can read order events" on public.order_events;
create policy "Admins can read order events" on public.order_events for select to authenticated using(public.is_admin());
drop policy if exists "Admins can manage contact messages" on public.contact_messages;
create policy "Admins can manage contact messages" on public.contact_messages for all to authenticated using(public.is_admin()) with check(public.is_admin());

insert into storage.buckets(id,name,public) values('product-images','product-images',true) on conflict(id) do update set public=true;
drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images" on storage.objects for select using(bucket_id='product-images');
drop policy if exists "Admins can manage product images" on storage.objects;
create policy "Admins can manage product images" on storage.objects for all to authenticated using(bucket_id='product-images' and public.is_admin()) with check(bucket_id='product-images' and public.is_admin());

-- Crear el usuario administrador desde Supabase Auth y después ejecutar:
-- insert into public.admin_users(user_id) values ('UUID_DEL_USUARIO');
-- Campos añadidos para informes fiscales
alter table public.products add column if not exists vat_rate numeric(5,2) not null default 10;
alter table public.order_items add column if not exists vat_rate numeric(5,2) not null default 10;
alter table public.order_items add column if not exists customizations jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists refunded_amount numeric(10,2) not null default 0 check (refunded_amount >= 0);
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
