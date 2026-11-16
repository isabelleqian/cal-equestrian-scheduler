-- Cal Equestrian Lesson Scheduler: database schema
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- It is safe to run more than once.

-- ---------------------------------------------------------------
-- Admins: a list of email addresses allowed to see the admin pages
-- ---------------------------------------------------------------
create table if not exists public.admins (
  email    text primary key,
  added_at timestamptz not null default now()
);

-- Returns true when the signed-in user's email is in the admins table.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------
-- Member profiles
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null default (auth.jwt() ->> 'email'),
  name       text not null check (char_length(name) between 1 and 80),
  is_driver  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Weekly availability. slots holds cell numbers: day * 19 + cell,
-- day 0 = Monday, cell 0 = 7:30 AM, cell 18 = 4:30 PM (30-minute cells).
-- ---------------------------------------------------------------
create table if not exists public.availability (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  slots      smallint[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Coach availability (a single row)
create table if not exists public.coach_availability (
  id         smallint primary key default 1 check (id = 1),
  slots      smallint[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.coach_availability (id) values (1) on conflict (id) do nothing;

-- Saved pairing results
create table if not exists public.pairings (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  created_by  text,
  label       text,
  is_selected boolean not null default false,
  data        jsonb not null
);

-- Keep updated_at current
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists availability_touch on public.availability;
create trigger availability_touch before update on public.availability
  for each row execute function public.touch_updated_at();
drop trigger if exists coach_touch on public.coach_availability;
create trigger coach_touch before update on public.coach_availability
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------
alter table public.admins             enable row level security;
alter table public.profiles           enable row level security;
alter table public.availability       enable row level security;
alter table public.coach_availability enable row level security;
alter table public.pairings           enable row level security;

-- admins: only admins can see or change the list
drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins for select to authenticated using (public.is_admin());
drop policy if exists admins_write on public.admins;
create policy admins_write on public.admins for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles: members see and edit their own row; admins see and edit all
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using (id = auth.uid() or public.is_admin());

-- availability: same rules as profiles
drop policy if exists availability_select on public.availability;
create policy availability_select on public.availability for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists availability_insert on public.availability;
create policy availability_insert on public.availability for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists availability_update on public.availability;
create policy availability_update on public.availability for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists availability_delete on public.availability;
create policy availability_delete on public.availability for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- coach availability: any signed-in member can view it, only admins change it
drop policy if exists coach_select on public.coach_availability;
create policy coach_select on public.coach_availability for select to authenticated using (true);
drop policy if exists coach_write on public.coach_availability;
create policy coach_write on public.coach_availability for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- pairings: admins only
drop policy if exists pairings_admin on public.pairings;
create policy pairings_admin on public.pairings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- New semester reset (admins only). Clears every member's grid and the
-- coach's grid. Profiles and saved pairings are kept for reference.
-- ---------------------------------------------------------------
create or replace function public.reset_semester()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can reset the semester';
  end if;
  delete from public.availability where user_id is not null;
  update public.coach_availability set slots = '{}', updated_by = auth.jwt() ->> 'email' where id = 1;
  update public.pairings set is_selected = false where is_selected;
end;
$$;

-- ---------------------------------------------------------------
-- Grants (the anon role gets nothing; everything needs sign-in)
-- ---------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.admins, public.profiles, public.availability,
  public.coach_availability, public.pairings to authenticated;
revoke all on public.admins, public.profiles, public.availability,
  public.coach_availability, public.pairings from anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.reset_semester() to authenticated;
revoke execute on function public.reset_semester() from anon, public;

-- ---------------------------------------------------------------
-- Add yourself as an admin: replace the email below and run this line.
-- ---------------------------------------------------------------
-- insert into public.admins (email) values ('your.email@berkeley.edu') on conflict do nothing;
