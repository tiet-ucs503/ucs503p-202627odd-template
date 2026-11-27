-- Migration 20261006000001_persistent_state.sql
-- Store one-time tokens, auth sessions, pending registrations, and rate-limit buckets in persistent storage.

create table if not exists intellischedule.one_time_tokens (
  token_hash  text primary key,
  email       text not null,
  purpose     text not null check (purpose in ('email_verification', 'password_reset')),
  expires_at  timestamptz not null,
  is_used     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists one_time_tokens_email_idx on intellischedule.one_time_tokens(email);
create index if not exists one_time_tokens_expiry_idx on intellischedule.one_time_tokens(expires_at);

create table if not exists intellischedule.pending_registrations (
  email         text primary key,
  name          text not null,
  password_hash text not null,
  role_code     text not null,
  role_name     text not null,
  department    text not null,
  created_at    timestamptz not null default now()
);

create table if not exists intellischedule.rate_limit_buckets (
  key         text primary key,
  count       integer not null default 0,
  resets_at   timestamptz not null,
  updated_at  timestamptz not null default now()
);
create index if not exists rate_limit_buckets_expiry_idx on intellischedule.rate_limit_buckets(resets_at);

alter table intellischedule.one_time_tokens       enable row level security;
alter table intellischedule.pending_registrations enable row level security;
alter table intellischedule.rate_limit_buckets     enable row level security;
