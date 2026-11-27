-- IntelliSchedule runtime schema. Applied automatically at server start (idempotent).
-- Lives in its own schema: Supabase's REST API only exposes `public`, so these tables are
-- reachable solely through the server's direct Postgres connection. RLS is enabled with no
-- policies as a second lock in case the schema is ever exposed.

create schema if not exists intellischedule;

create table if not exists intellischedule.users (
  id            text primary key,
  email         text not null unique,
  name          text not null,
  role_code     text not null check (role_code in
                  ('SUPER_ADMIN','COLLEGE_ADMIN','COORDINATOR','HOD','FACULTY','CLASS_REPRESENTATIVE','STUDENT')),
  department    text not null default '',
  password_hash text,                    -- null = Google sign-in only
  google_sub    text unique,
  status        text not null default 'ACTIVE' check (status in ('ACTIVE','LOCKED')),
  is_demo       boolean not null default false,
  profile       jsonb not null default '{}'::jsonb,  -- phone, office, roll number, section, avatar, ...
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists intellischedule.auth_sessions (
  token_hash  text primary key,          -- sha256 of the session token; the raw token is never stored
  user_id     text not null references intellischedule.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists auth_sessions_user_idx on intellischedule.auth_sessions(user_id);
create index if not exists auth_sessions_expiry_idx on intellischedule.auth_sessions(expires_at);

create table if not exists intellischedule.oauth_states (
  state       text primary key,
  created_at  timestamptz not null default now()
);

-- Academic master data and the live timetable, one JSON document per area.
-- `version` gives optimistic concurrency: a writer that lost a race fails instead of overwriting.
create table if not exists intellischedule.app_state (
  key         text primary key,
  data        jsonb not null,
  version     integer not null default 1,
  updated_at  timestamptz not null default now()
);

-- Timetable versions: append-only except the published flag.
create table if not exists intellischedule.timetable_versions (
  version_number integer primary key,
  data           jsonb not null,
  is_published   boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Append-only audit trail.
create table if not exists intellischedule.audit_log (
  id          text primary key,
  at          timestamptz not null,
  user_name   text not null,
  action      text not null,
  entity_type text not null,
  entity_id   text not null,
  details     text not null
);
create index if not exists audit_log_at_idx on intellischedule.audit_log(at desc);

alter table intellischedule.users              enable row level security;
alter table intellischedule.auth_sessions      enable row level security;
alter table intellischedule.oauth_states       enable row level security;
alter table intellischedule.app_state          enable row level security;
alter table intellischedule.timetable_versions enable row level security;
alter table intellischedule.audit_log          enable row level security;
