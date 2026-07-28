-- SOHO Cambados: opciones obligatorias y extras elegidos por línea de pedido.
alter table public.order_items
  add column if not exists customizations jsonb not null default '{}'::jsonb;

comment on column public.order_items.customizations is
  'Elección obligatoria, extras, precio base y suplemento aplicados a la línea en el momento del pedido.';

notify pgrst, 'reload schema';
