-- FrontDesk AI: tables for tickets, chat messages and clinic data.
-- Run once in the Supabase SQL editor. Safe to run again.
-- Row level security is ON with no public rules: only the server (secret key) can read or write.

create table if not exists public.fd_tickets (
  id bigint generated always as identity primary key,
  patient_id text not null,
  question text not null,
  bot_reply text not null,
  status text not null check (status in ('answered', 'needs human', 'urgent', 'closed')),
  kind text,
  requested_time text,
  lang text not null default 'en',
  source text not null default 'file',
  patient_name text,
  patient_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fd_messages (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.fd_tickets(id) on delete cascade,
  patient_id text not null,
  sender text not null check (sender in ('patient', 'bot', 'staff')),
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fd_clinic (
  id int primary key check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists fd_messages_patient_idx on public.fd_messages (patient_id, id);
create index if not exists fd_messages_ticket_idx on public.fd_messages (ticket_id);

alter table public.fd_tickets enable row level security;
alter table public.fd_messages enable row level security;
alter table public.fd_clinic enable row level security;

-- Added later (safe to run on an existing project)
alter table public.fd_tickets add column if not exists patient_name text;
alter table public.fd_tickets add column if not exists patient_phone text;
create index if not exists fd_tickets_phone_idx on public.fd_tickets (patient_phone) where patient_phone is not null;
