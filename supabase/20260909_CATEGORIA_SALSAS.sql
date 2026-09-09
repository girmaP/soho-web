-- SOHO Cambados · categoría de salsas vendidas como productos independientes.
-- Ejecutar una sola vez en Supabase antes de desplegar esta versión.
-- No modifica los extras configurados para bocatas, hamburguesas, etc.

do $$
declare
  sauces_category_id uuid;
  product_name text;
  affected_rows integer;
begin
  select id
    into sauces_category_id
  from public.categories
  where lower(trim(name)) = 'salsas'
  order by created_at
  limit 1;

  if sauces_category_id is null then
    insert into public.categories (name, sort_order)
    values (
      'Salsas',
      coalesce((select max(sort_order) + 1 from public.categories), 1)
    )
    returning id into sauces_category_id;
  end if;

  foreach product_name in array array[
    'Alioli',
    'Salsa brava',
    'Salsa César',
    'Tabasco'
  ] loop
    update public.products
    set
      name = product_name,
      price = 1.00,
      category_id = sauces_category_id,
      available = true,
      vat_rate = 10
    where lower(trim(name)) = lower(product_name)
       or (
         product_name = 'Salsa César'
         and lower(trim(name)) = 'salsa cesar'
       );

    get diagnostics affected_rows = row_count;

    if affected_rows = 0 then
      insert into public.products (
        name,
        description,
        price,
        category_id,
        available,
        recommended,
        vat_rate
      ) values (
        product_name,
        'Botecito de salsa',
        1.00,
        sauces_category_id,
        true,
        false,
        10
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
