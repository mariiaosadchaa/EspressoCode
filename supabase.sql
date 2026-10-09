-- Виконай цей скрипт один раз: Supabase → SQL Editor → New query → Run.
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

-- Кожен користувач бачить і змінює тільки свій рядок.
create policy "own select" on public.progress for select using (auth.uid() = user_id);
create policy "own insert" on public.progress for insert with check (auth.uid() = user_id);
create policy "own update" on public.progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own delete" on public.progress for delete using (auth.uid() = user_id);
