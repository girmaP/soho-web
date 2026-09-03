-- SOHO Cambados · cola segura para impresión automática.
-- Ejecutar una sola vez en el proyecto de Supabase de producción.

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','claimed','printed','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  worker_id text,
  claimed_at timestamptz,
  printed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists print_jobs_pending_idx
  on public.print_jobs(created_at) where status in ('pending','failed');

drop trigger if exists print_jobs_set_updated_at on public.print_jobs;
create trigger print_jobs_set_updated_at before update on public.print_jobs
  for each row execute function public.set_updated_at();

create or replace function public.claim_print_jobs(p_worker_id text,p_limit integer default 5)
returns setof public.print_jobs
language plpgsql security definer set search_path=public
as $$
begin
  return query
  with candidates as (
    select id from public.print_jobs
    where attempts < 20 and (
      status in ('pending','failed')
      or (status='claimed' and claimed_at < now() - interval '2 minutes')
    )
    order by created_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,5),20))
  )
  update public.print_jobs jobs
  set status='claimed',worker_id=left(trim(p_worker_id),100),claimed_at=now(),
      attempts=jobs.attempts+1,last_error=null,updated_at=now()
  from candidates where jobs.id=candidates.id
  returning jobs.*;
end $$;

revoke all on function public.claim_print_jobs(text,integer) from public;
grant execute on function public.claim_print_jobs(text,integer) to service_role;
alter table public.print_jobs enable row level security;
revoke all on public.print_jobs from anon,authenticated;
grant select on public.print_jobs to authenticated;
grant all on public.print_jobs to service_role;

drop policy if exists "Admins can read print jobs" on public.print_jobs;
create policy "Admins can read print jobs" on public.print_jobs
  for select to authenticated using(public.is_admin());

notify pgrst,'reload schema';
