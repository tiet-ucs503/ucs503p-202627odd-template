-- Additive performance indexes for IntelliSchedule runtime tables.
-- Safe and idempotent; does not modify earlier applied migration checksums.

create index if not exists users_role_status_idx
  on intellischedule.users (role_code, status);

create index if not exists users_department_idx
  on intellischedule.users (department)
  where department <> '';

create index if not exists auth_sessions_user_expiry_idx
  on intellischedule.auth_sessions (user_id, expires_at desc);

create index if not exists sessions_active_user_idx
  on intellischedule.sessions (user_id, expires_at desc)
  where is_revoked = false;

create index if not exists one_time_tokens_active_lookup_idx
  on intellischedule.one_time_tokens (email, purpose, expires_at desc)
  where is_used = false;

create index if not exists timetable_versions_published_idx
  on intellischedule.timetable_versions (version_number desc)
  where is_published = true;

create index if not exists audit_log_entity_idx
  on intellischedule.audit_log (entity_type, entity_id, at desc);
