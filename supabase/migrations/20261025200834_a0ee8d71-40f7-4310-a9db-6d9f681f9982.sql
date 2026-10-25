create table public.fleet_eta_links (
  token uuid primary key default gen_random_uuid(),
  registration text not null,
  created_by uuid,
  sent_to_phone text,
  sent_to_email text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);
alter table public.fleet_eta_links enable row level security;
create policy "fleet staff read eta links" on public.fleet_eta_links for select to authenticated
  using (public.is_fleet_staff((select auth.uid())));
grant select on public.fleet_eta_links to authenticated;
grant all on public.fleet_eta_links to service_role;