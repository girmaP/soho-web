-- SOHO Cambados · esquema/actualización final de producción
-- Idempotente y no destructivo: conserva productos, imágenes, usuarios, pedidos e históricos existentes.
-- Ejecutar una sola vez en Supabase SQL Editor antes de publicar la versión final.

create extension if not exists pgcrypto;

-- Tipos ----------------------------------------------------------------------
do $$ begin
  create type public.order_status as enum ('pending','accepted','preparing','ready','delivered','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_type as enum ('pickup','delivery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending','authorized','paid','failed','cancelled','refund_pending','refunded');
exception when duplicate_object then null; end $$;

alter type public.payment_status add value if not exists 'authorized';
alter type public.payment_status add value if not exists 'cancelled';
alter type public.payment_status add value if not exists 'refund_pending';
alter type public.payment_status add value if not exists 'refunded';

-- Tablas base ----------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  category_id uuid references public.categories(id) on delete set null,
  image_url text,
  available boolean not null default true,
  estimated_time_category text,
  recommended boolean not null default false,
  vat_rate numeric(5,2) not null default 10,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  order_type public.order_type not null default 'pickup',
  delivery_address text,
  notes text,
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  payment_method text not null default 'stripe',
  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_refund_id text,
  checkout_attempt_id text,
  cancellation_reason text,
  refund_reason text,
  order_token text not null default encode(gen_random_bytes(24),'hex'),
  accepted_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  received_acknowledged_at timestamptz,
  received_acknowledged_by uuid references auth.users(id) on delete set null,
  estimated_time integer check (estimated_time between 5 and 180),
  total_price numeric(10,2) not null check (total_price >= 0),
  refunded_amount numeric(10,2) not null default 0 check (refunded_amount >= 0),
  stripe_fee_amount numeric(10,2) not null default 0 check (stripe_fee_amount >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  total_price numeric(10,2) not null check (total_price >= 0),
  vat_rate numeric(5,2) not null default 10,
  customizations jsonb not null default '{}'::jsonb
);

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  event_type text not null,
  actor_type text not null default 'system',
  actor_id uuid,
  from_status text,
  to_status text,
  stripe_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing',
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.order_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  email_kind text not null,
  recipient text not null,
  status text not null default 'sending' check (status in ('sending','sent','failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, email_kind)
);

create table if not exists public.business_settings (
  id text primary key default 'main',
  opening_time text not null default '09:00',
  closing_time text not null default '23:30',
  manual_pause boolean not null default false,
  closed_days integer[] not null default '{}',
  minimum_order numeric(10,2) not null default 0,
  default_wait_minutes integer not null default 10 check (default_wait_minutes between 5 and 180),
  weekly_hours jsonb not null default '{"1":{"open":"09:00","close":"23:30","closed":false},"2":{"open":"09:00","close":"23:30","closed":false},"3":{"open":"09:00","close":"23:30","closed":false},"4":{"open":"09:00","close":"23:30","closed":false},"5":{"open":"09:00","close":"00:30","closed":false},"6":{"open":"09:00","close":"00:30","closed":false},"0":{"open":"09:00","close":"23:30","closed":false}}'::jsonb,
  service_start_date date,
  printer_price_per_ticket numeric(10,4) not null default 0,
  monthly_management_fee numeric(10,2) not null default 0,
  monthly_hosting_fee numeric(10,2) not null default 0,
  annual_domain_fee numeric(10,2) not null default 0,
  fiscal_name text not null default 'SOHO Cambados',
  fiscal_nif text not null default '',
  fiscal_address text not null default '',
  admin_email text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  message text not null,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibilidad con instalaciones existentes --------------------------------
alter table public.products add column if not exists recommended boolean not null default false;
alter table public.products add column if not exists vat_rate numeric(5,2) not null default 10;
alter table public.order_items add column if not exists vat_rate numeric(5,2) not null default 10;
alter table public.order_items add column if not exists customizations jsonb not null default '{}'::jsonb;

alter table public.orders add column if not exists customer_email text;
update public.orders set customer_email='pendiente@soho.invalid' where customer_email is null;
alter table public.orders alter column customer_email set not null;
alter table public.orders add column if not exists stripe_refund_id text;
alter table public.orders add column if not exists checkout_attempt_id text;
alter table public.orders add column if not exists refund_reason text;
alter table public.orders add column if not exists accepted_at timestamptz;
alter table public.orders add column if not exists preparing_at timestamptz;
alter table public.orders add column if not exists ready_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists refunded_at timestamptz;
alter table public.orders add column if not exists received_acknowledged_at timestamptz;
alter table public.orders add column if not exists received_acknowledged_by uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists refunded_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists stripe_fee_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists archived_at timestamptz;

alter table public.business_settings add column if not exists minimum_order numeric(10,2) not null default 0;
alter table public.business_settings add column if not exists default_wait_minutes integer not null default 10;
alter table public.business_settings add column if not exists service_start_date date;
alter table public.business_settings add column if not exists printer_price_per_ticket numeric(10,4) not null default 0;
alter table public.business_settings add column if not exists monthly_management_fee numeric(10,2) not null default 0;
alter table public.business_settings add column if not exists monthly_hosting_fee numeric(10,2) not null default 0;
alter table public.business_settings add column if not exists annual_domain_fee numeric(10,2) not null default 0;
alter table public.business_settings add column if not exists fiscal_name text not null default 'SOHO Cambados';
alter table public.business_settings add column if not exists fiscal_nif text not null default '';
alter table public.business_settings add column if not exists fiscal_address text not null default '';
alter table public.business_settings add column if not exists admin_email text not null default '';

update public.orders
set refunded_amount = total_price
where payment_status = 'refunded' and coalesce(refunded_amount,0)=0;

-- Compatibilidad adicional para instalaciones antiguas ------------------------
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists order_token text not null default encode(gen_random_bytes(24),'hex');
alter table public.orders add column if not exists stripe_session_id text;
alter table public.orders add column if not exists stripe_payment_intent_id text;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists estimated_time integer;
alter table public.orders add column if not exists total_price numeric(10,2) not null default 0;
alter table public.business_settings add column if not exists updated_at timestamptz not null default now();
alter table public.contact_messages add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists business_settings_set_updated_at on public.business_settings;
create trigger business_settings_set_updated_at before update on public.business_settings for each row execute function public.set_updated_at();
drop trigger if exists contact_messages_set_updated_at on public.contact_messages;
create trigger contact_messages_set_updated_at before update on public.contact_messages for each row execute function public.set_updated_at();
drop trigger if exists order_email_deliveries_set_updated_at on public.order_email_deliveries;
create trigger order_email_deliveries_set_updated_at before update on public.order_email_deliveries for each row execute function public.set_updated_at();

-- La categoría ya retirada no se ofrece al consumidor.
update public.products
set available = false
where category_id in (
  select id from public.categories where lower(trim(name)) = 'prepara tu combi desayuno'
);

-- Índices --------------------------------------------------------------------
create unique index if not exists orders_order_token_key on public.orders(order_token);
create unique index if not exists orders_checkout_attempt_id_key on public.orders(checkout_attempt_id) where checkout_attempt_id is not null;
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create unique index if not exists orders_stripe_session_id_key on public.orders(stripe_session_id) where stripe_session_id is not null;
create unique index if not exists orders_stripe_payment_intent_id_key on public.orders(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index if not exists orders_unacknowledged_created_idx on public.orders(created_at desc) where received_acknowledged_at is null;
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_events_order_id_idx on public.order_events(order_id,created_at);
create index if not exists products_category_id_idx on public.products(category_id);

insert into public.business_settings(id) values('main') on conflict(id) do nothing;
update public.business_settings set
  service_start_date=coalesce(service_start_date,current_date),
  fiscal_address=case when trim(coalesce(fiscal_address,''))='' then 'Calle A Mariña, 3, 36630 Cambados, Pontevedra' else fiscal_address end,
  admin_email=case when trim(coalesce(admin_email,''))='' then 'sohocambados@gmail.com' else admin_email end
where id='main';

-- Reclamo atomico: solo un proceso maneja cada evento. Los fallidos pueden
-- reintentarse; los ya procesados o actualmente en curso se ignoran.
create or replace function public.claim_stripe_webhook_event(p_event_id text,p_event_type text)
returns boolean
language plpgsql security definer set search_path=public
as $$
declare claimed boolean;
begin
  insert into public.stripe_webhook_events(event_id,event_type,status,processed_at,error_message)
  values(p_event_id,p_event_type,'processing',null,null)
  on conflict(event_id) do update set
    event_type=excluded.event_type,
    status='processing',
    processed_at=null,
    error_message=null
  where stripe_webhook_events.status='failed'
  returning true into claimed;
  return coalesce(claimed,false);
end $$;
revoke all on function public.claim_stripe_webhook_event(text,text) from public;
grant execute on function public.claim_stripe_webhook_event(text,text) to service_role;

-- Diagnostico de produccion seguro. Comprueba el contrato que usa la aplicacion
-- y realiza una escritura temporal sin crear ni modificar pedidos o catalogo.
create or replace function public.production_preflight()
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  missing text[] := '{}';
  required_table text;
  required_column text;
  required_field text;
  required_rpc text;
  test_event_id text := 'preflight_' || gen_random_uuid()::text;
  first_claim boolean;
  duplicate_claim boolean;
  retry_claim boolean;
begin
  foreach required_table in array array[
    'categories','products','admin_users','orders','order_items','order_events',
    'stripe_webhook_events','order_email_deliveries','business_settings','contact_messages'
  ] loop
    if to_regclass('public.' || required_table) is null then
      missing := array_append(missing,'table:' || required_table);
    end if;
  end loop;

  foreach required_column in array array[
    'id','customer_name','customer_phone','customer_email','order_type','delivery_address','notes',
    'status','payment_status','payment_method','stripe_session_id','stripe_payment_intent_id',
    'stripe_refund_id','checkout_attempt_id','cancellation_reason','refund_reason','order_token',
    'accepted_at','preparing_at','ready_at','delivered_at','paid_at','cancelled_at','refunded_at',
    'received_acknowledged_at','received_acknowledged_by','estimated_time','total_price',
    'refunded_amount','stripe_fee_amount','archived_at','created_at','updated_at'
  ] loop
    if not exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='orders' and column_name=required_column
    ) then missing := array_append(missing,'orders.' || required_column); end if;
  end loop;

  foreach required_field in array array[
    'categories.id','categories.name','categories.sort_order','categories.created_at',
    'products.id','products.name','products.description','products.price','products.category_id',
    'products.image_url','products.available','products.estimated_time_category','products.recommended','products.vat_rate','products.created_at',
    'admin_users.user_id','admin_users.created_at',
    'order_events.id','order_events.order_id','order_events.event_type','order_events.actor_type',
    'order_events.actor_id','order_events.from_status','order_events.to_status','order_events.stripe_event_id','order_events.metadata','order_events.created_at',
    'stripe_webhook_events.event_id','stripe_webhook_events.event_type','stripe_webhook_events.status',
    'stripe_webhook_events.error_message','stripe_webhook_events.created_at','stripe_webhook_events.processed_at',
    'order_email_deliveries.id','order_email_deliveries.order_id','order_email_deliveries.email_kind',
    'order_email_deliveries.recipient','order_email_deliveries.status','order_email_deliveries.error_message',
    'order_email_deliveries.sent_at','order_email_deliveries.created_at','order_email_deliveries.updated_at',
    'business_settings.id','business_settings.opening_time','business_settings.closing_time','business_settings.manual_pause',
    'business_settings.closed_days','business_settings.minimum_order','business_settings.weekly_hours','business_settings.service_start_date',
    'business_settings.default_wait_minutes',
    'business_settings.printer_price_per_ticket','business_settings.monthly_management_fee','business_settings.monthly_hosting_fee',
    'business_settings.annual_domain_fee','business_settings.fiscal_name','business_settings.fiscal_nif','business_settings.fiscal_address',
    'business_settings.admin_email','business_settings.updated_at',
    'contact_messages.id','contact_messages.name','contact_messages.email','contact_messages.phone',
    'contact_messages.message','contact_messages.read','contact_messages.read_at','contact_messages.created_at','contact_messages.updated_at'
  ] loop
    if not exists(
      select 1 from information_schema.columns
      where table_schema='public'
        and table_name=split_part(required_field,'.',1)
        and column_name=split_part(required_field,'.',2)
    ) then missing := array_append(missing,required_field); end if;
  end loop;

  foreach required_rpc in array array[
    'public.claim_stripe_webhook_event(text,text)',
    'public.production_preflight()',
    'public.is_admin()',
    'public.submit_contact_message(text,text,text,text)',
    'public.cleanup_read_contact_messages_older_than_15_days()'
  ] loop
    if to_regprocedure(required_rpc) is null then
      missing := array_append(missing,'rpc:' || required_rpc);
    end if;
  end loop;

  foreach required_column in array array[
    'id','order_id','product_id','product_name','quantity','unit_price','total_price','vat_rate','customizations'
  ] loop
    if not exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='order_items' and column_name=required_column
    ) then missing := array_append(missing,'order_items.' || required_column); end if;
  end loop;

  if cardinality(missing) > 0 then
    return jsonb_build_object('ok',false,'missing',to_jsonb(missing),'write_ok',false,'claim_ok',false);
  end if;

  first_claim := public.claim_stripe_webhook_event(test_event_id,'preflight.test');
  duplicate_claim := public.claim_stripe_webhook_event(test_event_id,'preflight.test');
  update public.stripe_webhook_events set status='failed' where event_id=test_event_id;
  retry_claim := public.claim_stripe_webhook_event(test_event_id,'preflight.test');
  delete from public.stripe_webhook_events where event_id=test_event_id;

  return jsonb_build_object(
    'ok',first_claim and not duplicate_claim and retry_claim,
    'missing','[]'::jsonb,
    'write_ok',true,
    'claim_ok',first_claim and not duplicate_claim and retry_claim
  );
exception when others then
  delete from public.stripe_webhook_events where event_id=test_event_id;
  return jsonb_build_object('ok',false,'missing',to_jsonb(missing),'write_ok',false,'claim_ok',false,'error',sqlstate);
end $$;
revoke all on function public.production_preflight() from public;
grant execute on function public.production_preflight() to service_role;

-- Seguridad ------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.admin_users where user_id=auth.uid()); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.submit_contact_message(p_name text,p_email text,p_phone text,p_message text)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare new_id uuid;
begin
  if length(trim(p_name)) < 2 or length(trim(p_message)) < 5 then raise exception 'Datos no válidos'; end if;
  insert into public.contact_messages(name,email,phone,message)
  values(trim(p_name),nullif(trim(p_email),''),nullif(trim(p_phone),''),trim(p_message))
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.submit_contact_message(text,text,text,text) from public;
grant execute on function public.submit_contact_message(text,text,text,text) to anon,authenticated,service_role;

create or replace function public.cleanup_read_contact_messages_older_than_15_days()
returns integer
language plpgsql security definer set search_path=public
as $$
declare removed integer;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  delete from public.contact_messages where read=true and coalesce(read_at,created_at) < now() - interval '15 days';
  get diagnostics removed = row_count;
  return removed;
end $$;
revoke all on function public.cleanup_read_contact_messages_older_than_15_days() from public;
grant execute on function public.cleanup_read_contact_messages_older_than_15_days() to authenticated,service_role;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.order_email_deliveries enable row level security;
alter table public.business_settings enable row level security;
alter table public.contact_messages enable row level security;

-- El panel depende de cambios en tiempo real para mostrar una autorizacion
-- inmediatamente despues de que el webhook active el pedido.
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.order_items;
exception when duplicate_object then null; end $$;

revoke all on public.orders,public.order_items,public.order_events,public.stripe_webhook_events,public.order_email_deliveries from anon;
grant select on public.categories,public.products,public.business_settings to anon,authenticated;
grant all on public.categories,public.products,public.orders,public.order_items,public.order_events,public.business_settings,public.contact_messages to authenticated;
grant select on public.admin_users to authenticated;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

-- Políticas públicas y de administración.
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

-- Storage de imágenes de producto -------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,10485760,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images" on storage.objects for select to public using(bucket_id='product-images');
drop policy if exists "Admins can manage product images" on storage.objects;
create policy "Admins can manage product images" on storage.objects for all to authenticated
using(bucket_id='product-images' and public.is_admin())
with check(bucket_id='product-images' and public.is_admin());

-- Evita que pedidos existentes antes de activar la alarma generen avisos históricos.
update public.orders
set received_acknowledged_at=coalesce(received_acknowledged_at,now())
where received_acknowledged_at is null and created_at < now() - interval '10 minutes';


-- Comprobación rápida posterior a la instalación ------------------------------
create or replace view public.soho_production_schema_check as
select
  to_regclass('public.orders') is not null as orders_ok,
  to_regclass('public.order_items') is not null as order_items_ok,
  to_regclass('public.stripe_webhook_events') is not null as stripe_webhook_events_ok,
  to_regclass('public.order_email_deliveries') is not null as order_email_deliveries_ok,
  to_regclass('public.business_settings') is not null as business_settings_ok;

notify pgrst,'reload schema';
