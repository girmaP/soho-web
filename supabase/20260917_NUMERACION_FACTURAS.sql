-- SOHO Cambados · numeración correlativa para facturas de la web.
-- Formato final: F-WEB-0001, F-WEB-0002, ...

alter table public.orders
  add column if not exists invoice_number text;

create unique index if not exists orders_invoice_number_unique
  on public.orders (invoice_number)
  where invoice_number is not null;

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
