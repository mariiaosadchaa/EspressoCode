-- Крок 1. Таблиця підписок на сповіщення. Виконай у Supabase → SQL Editor → Run.
create table if not exists public.push_subs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sub jsonb not null,
  remind text not null default '19:00',
  tz text not null default 'UTC',
  last_sent text,
  updated_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
create policy "own select" on public.push_subs for select using (auth.uid() = user_id);
create policy "own insert" on public.push_subs for insert with check (auth.uid() = user_id);
create policy "own update" on public.push_subs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own delete" on public.push_subs for delete using (auth.uid() = user_id);

-- Крок 2 (після того, як створила функцію send-reminders і додала секрети).
-- Заміни <ТВІЙ_CRON_SECRET> на той самий секрет, що в функції, і виконай окремо:
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule(
--   'barista-reminders', '*/15 * * * *',
--   $$ select net.http_post(
--        url := 'https://gtocmeabkpzaveuomxtp.supabase.co/functions/v1/send-reminders',
--        headers := jsonb_build_object('x-cron-secret', '<ТВІЙ_CRON_SECRET>', 'Content-Type', 'application/json'),
--        body := '{}'::jsonb
--      ) $$
-- );
