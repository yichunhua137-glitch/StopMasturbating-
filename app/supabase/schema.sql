create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.habit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;
alter table public.habit_events enable row level security;

drop policy if exists "authenticated users can read profiles" on public.profiles;
create policy "authenticated users can read profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "users can upsert own profile" on public.profiles;
create policy "users can upsert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "authenticated users can read events" on public.habit_events;
create policy "authenticated users can read events"
  on public.habit_events
  for select
  to authenticated
  using (true);

drop policy if exists "users can insert own events" on public.habit_events;
create policy "users can insert own events"
  on public.habit_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);
