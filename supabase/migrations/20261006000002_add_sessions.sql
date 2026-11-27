-- Migration 20261006000002_add_sessions.sql
-- Store active and revoked sessions in persistent storage

create table if not exists intellischedule.sessions (
  token_hash  text primary key,
  user_id     text not null,
  role_code   text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  is_revoked  boolean not null default false
);
create index if not exists sessions_expiry_idx on intellischedule.sessions(expires_at);
create index if not exists sessions_user_id_idx on intellischedule.sessions(user_id);

alter table intellischedule.sessions enable row level security;
