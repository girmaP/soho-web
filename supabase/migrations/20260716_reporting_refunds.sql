-- SOHO Cambados: informes para gestoría, costes operativos e IVA por producto.
-- Migración incremental y segura para ejecutar después de 20260715_production_hardening.sql.
alter table public.orders add column if not exists stripe_fee_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists refund_reason text;
alter table public.products add column if not exists vat_rate numeric(5,2) not null default 10 check (vat_rate in (10,21));
alter table public.order_items add column if not exists vat_rate numeric(5,2) not null default 10 check (vat_rate in (10,21));
alter table public.business_settings add column if not exists service_start_date date;
alter table public.business_settings add column if not exists printer_price_per_ticket numeric(10,4) not null default 0 check (printer_price_per_ticket >= 0);
alter table public.business_settings add column if not exists monthly_management_fee numeric(10,2) not null default 0 check (monthly_management_fee >= 0);
alter table public.business_settings add column if not exists monthly_hosting_fee numeric(10,2) not null default 0 check (monthly_hosting_fee >= 0);
alter table public.business_settings add column if not exists annual_domain_fee numeric(10,2) not null default 0 check (annual_domain_fee >= 0);
alter table public.business_settings add column if not exists fiscal_name text not null default 'SOHO Cambados';
alter table public.business_settings add column if not exists fiscal_nif text not null default '';
alter table public.business_settings add column if not exists fiscal_address text not null default '';
alter table public.business_settings add column if not exists admin_email text not null default '';
notify pgrst, 'reload schema';
update public.order_items oi
set vat_rate = p.vat_rate
from public.products p
where oi.product_id = p.id and oi.vat_rate = 10 and p.vat_rate <> 10;
