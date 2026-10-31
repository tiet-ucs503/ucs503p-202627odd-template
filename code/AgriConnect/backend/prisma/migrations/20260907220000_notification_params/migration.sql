-- Structured notification payload so the UI can render copy in the reader's language.
-- Nullable: rows created before this migration keep serving their stored title/body.
ALTER TABLE "notifications" ADD COLUMN "params" JSONB;
