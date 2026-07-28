-- SOHO Cambados: importe de reembolso confirmado para informes netos y reembolsos parciales.
alter table public.orders
  add column if not exists refunded_amount numeric(10,2) not null default 0 check (refunded_amount >= 0);

update public.orders
set refunded_amount = total_price
where payment_status = 'refunded' and coalesce(refunded_amount, 0) = 0;

notify pgrst, 'reload schema';
