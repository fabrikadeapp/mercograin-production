-- ============================================
-- ConversationMessage / WhatsAppMessage — campos silenced
--
-- Mensagens recebidas enquanto uma integração está pausada são gravadas
-- normalmente mas com silenced=true. UI exibe estilo opaco e workers
-- (IA, scoring, alertas) IGNORAM até o admin reativar e decidir.
--
-- Apply: psql $DATABASE_URL -f prisma/migrations/manual_silenced_messages.sql
-- Idempotente.
-- ============================================

BEGIN;

-- ConversationMessage (email, instagram, portal)
ALTER TABLE "ConversationMessage"
  ADD COLUMN IF NOT EXISTS "silenced"        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "silencedBatchId" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "silencedAt"      TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ConversationMessage_workspaceId_silenced_idx"
  ON "ConversationMessage" ("workspaceId", "silenced");

-- WhatsAppMessage
ALTER TABLE "WhatsAppMessage"
  ADD COLUMN IF NOT EXISTS "silenced"        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "silencedBatchId" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "silencedAt"      TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_workspaceId_silenced_idx"
  ON "WhatsAppMessage" ("workspaceId", "silenced");

COMMIT;
