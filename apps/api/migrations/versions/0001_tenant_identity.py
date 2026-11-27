"""Initial tenant and identity tables isolated from the legacy public schema."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.models import SCHEMA

revision = "0001_tenant_identity"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
    op.create_table(
        "institutions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        schema=SCHEMA,
    )
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("auth_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="ACTIVE"),
        sa.CheckConstraint("role IN ('SUPER_ADMIN','COLLEGE_ADMIN','COORDINATOR','HOD','FACULTY','CR','STUDENT')"),
        sa.CheckConstraint("status IN ('ACTIVE','PENDING','LOCKED')"),
        sa.UniqueConstraint("auth_user_id"),
        sa.UniqueConstraint("institution_id", "email"),
        schema=SCHEMA,
    )
    op.create_index("users_institution_idx", "users", ["institution_id"], schema=SCHEMA)
    op.create_table(
        "event_outbox",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="PENDING"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_index("event_outbox_claim_idx", "event_outbox", ["status", "available_at"], schema=SCHEMA)
    op.create_index("event_outbox_tenant_idx", "event_outbox", ["institution_id"], schema=SCHEMA)

    for table in ("institutions", "users", "event_outbox"):
        op.execute(f"ALTER TABLE {SCHEMA}.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {SCHEMA}.{table} FORCE ROW LEVEL SECURITY")

    op.execute(f"""
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'intellischedule_app') THEN
            GRANT USAGE ON SCHEMA {SCHEMA} TO intellischedule_app;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {SCHEMA} TO intellischedule_app;
            ALTER DEFAULT PRIVILEGES IN SCHEMA {SCHEMA} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO intellischedule_app;
            ALTER DEFAULT PRIVILEGES IN SCHEMA {SCHEMA} GRANT USAGE, SELECT ON SEQUENCES TO intellischedule_app;
          END IF;
        END
        $$
    """)
    op.execute(f"REVOKE ALL ON SCHEMA {SCHEMA} FROM PUBLIC")
    op.execute(f"REVOKE ALL ON ALL TABLES IN SCHEMA {SCHEMA} FROM PUBLIC")
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA {SCHEMA} REVOKE ALL ON TABLES FROM PUBLIC")
    op.execute("""
        DO $$
        DECLARE role_name text;
        BEGIN
          FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
              EXECUTE format(
                'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA intellischedule_v2 FROM %I',
                role_name
              );
              EXECUTE format('REVOKE USAGE ON SCHEMA intellischedule_v2 FROM %I', role_name);
            END IF;
          END LOOP;
        END
        $$
    """)
    op.execute(f"""
        CREATE POLICY institutions_tenant_scope ON {SCHEMA}.institutions
        USING (id = nullif(current_setting('app.institution_id', true), '')::uuid)
        WITH CHECK (id = nullif(current_setting('app.institution_id', true), '')::uuid)
    """)
    op.execute(f"""
        CREATE POLICY users_tenant_scope ON {SCHEMA}.users
        USING (
          auth_user_id = nullif(current_setting('app.auth_user_id', true), '')::uuid
          OR institution_id = nullif(current_setting('app.institution_id', true), '')::uuid
        )
        WITH CHECK (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid)
    """)
    op.execute(f"""
        CREATE POLICY event_outbox_tenant_scope ON {SCHEMA}.event_outbox
        USING (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid)
        WITH CHECK (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid)
    """)


def downgrade() -> None:
    op.execute(f"DROP POLICY IF EXISTS event_outbox_tenant_scope ON {SCHEMA}.event_outbox")
    op.execute(f"DROP POLICY IF EXISTS users_tenant_scope ON {SCHEMA}.users")
    op.execute(f"DROP POLICY IF EXISTS institutions_tenant_scope ON {SCHEMA}.institutions")
    op.drop_index("event_outbox_tenant_idx", table_name="event_outbox", schema=SCHEMA)
    op.drop_index("event_outbox_claim_idx", table_name="event_outbox", schema=SCHEMA)
    op.drop_table("event_outbox", schema=SCHEMA)
    op.drop_index("users_institution_idx", table_name="users", schema=SCHEMA)
    op.drop_table("users", schema=SCHEMA)
    op.drop_table("institutions", schema=SCHEMA)
    op.execute(f"DROP SCHEMA IF EXISTS {SCHEMA}")

