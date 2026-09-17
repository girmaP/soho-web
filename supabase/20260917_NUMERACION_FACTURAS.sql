-- SOHO Cambados · numeración anual de facturas solicitadas.
-- Ejecutar una sola vez en Supabase.

alter table public.orders
  add column if not exists invoice_number text;

create unique index if not exists orders_invoice_number_unique
  on public.orders (invoice_number)
  where invoice_number is not null;

create table if not exists public.invoice_counters (
  year integer primary key,
  last_number integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer;
  v_number integer;
begin
  if new.invoice_requested = true
     and new.payment_status = 'paid'
     and new.invoice_number is null then

    v_year := extract(year from coalesce(new.paid_at, now()))::integer;

    insert into public.invoice_counters (year, last_number, updated_at)
    values (v_year, 1, now())
    on conflict (year)
    do update
      set last_number = public.invoice_counters.last_number + 1,
          updated_at = now()
    returning last_number into v_number;

    new.invoice_number := format(
      'F-%s-%s',
      v_year,
      lpad(v_number::text, 6, '0')
    );
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

-- Asigna número a facturas ya pagadas que todavía no tengan uno.
-- Se procesan por fecha de pago/creación para mantener un orden estable.
do $$
declare
  r record;
begin
  for r in
    select id
    from public.orders
    where invoice_requested = true
      and payment_status = 'paid'
      and invoice_number is null
    order by coalesce(paid_at, created_at), created_at, id
  loop
    update public.orders
    set invoice_number = null
    where id = r.id;
  end loop;
end $$;

notify pgrst, 'reload schema';
