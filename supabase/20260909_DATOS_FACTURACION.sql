-- SOHO Cambados · datos opcionales de facturación por pedido.
-- Ejecutar una sola vez en Supabase antes de desplegar esta versión.

alter table public.orders
  add column if not exists invoice_requested boolean not null default false,
  add column if not exists billing_tax_id text,
  add column if not exists billing_name text,
  add column if not exists billing_address text,
  add column if not exists billing_postal_code text,
  add column if not exists billing_city text,
  add column if not exists billing_province text;

alter table public.orders
  drop constraint if exists orders_billing_details_when_requested;

alter table public.orders
  add constraint orders_billing_details_when_requested check (
    invoice_requested = false
    or (
      nullif(trim(billing_tax_id), '') is not null
      and nullif(trim(billing_name), '') is not null
      and nullif(trim(billing_address), '') is not null
      and billing_postal_code ~ '^[0-9]{5}$'
      and nullif(trim(billing_city), '') is not null
      and nullif(trim(billing_province), '') is not null
    )
  ) not valid;

alter table public.orders
  validate constraint orders_billing_details_when_requested;

notify pgrst, 'reload schema';
