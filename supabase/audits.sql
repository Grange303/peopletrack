-- Audits module schema for PeopleTrack
-- Run this once in the Supabase SQL editor (Database → SQL editor → New query).
-- The app reads/writes this table via the publishable key, so RLS is left open
-- to mirror the existing employees / documents tables.

create table if not exists audits (
  id          text primary key,
  scheme      text not null,            -- e.g. 'sedex'
  title       text not null,
  audit_date  date,
  status      text default 'planning',  -- planning | in_progress | complete
  items       jsonb default '[]'::jsonb,
  created_at  timestamptz default now()
);

alter table audits enable row level security;

-- Permissive policy to match the other PeopleTrack tables.
drop policy if exists "audits_all" on audits;
create policy "audits_all" on audits
  for all using (true) with check (true);
