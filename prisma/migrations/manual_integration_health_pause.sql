-- ============================================
-- IntegrationHealth — toggle "pausar canal"
--
-- Permite o admin do workspace pausar temporariamente a ingestão
-- de eventos de uma integração específica (e-mail, WhatsApp, etc)
-- sem precisar deletar a credencial.
--
-- Apply: psql $DATABASE_URL -f prisma/migrations/manual_integration_health_pause.sql
-- Idempotente.
-- ============================================

BEGIN;

ALTER TABLE "IntegrationHealth"
  ADD COLUMN IF NOT EXISTS "paused"      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "pausedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pausedBy"    TEXT,
  ADD COLUMN IF NOT EXISTS "pausedReason" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "IntegrationHealth_workspaceId_paused_idx"
  ON "IntegrationHealth" ("workspaceId", "paused");

COMMIT;

-- Rollback:
-- BEGIN;
--   DROP INDEX IF EXISTS "IntegrationHealth_workspaceId_paused_idx";
--   ALTER TABLE "IntegrationHealth"
--     DROP COLUMN IF EXISTS "pausedReason",
--     DROP COLUMN IF EXISTS "pausedBy",
--     DROP COLUMN IF EXISTS "pausedUntil",
--     DROP COLUMN IF EXISTS "paused";
-- COMMIT;
