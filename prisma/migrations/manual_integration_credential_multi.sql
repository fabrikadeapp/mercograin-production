-- ============================================
-- IntegrationCredential — multi-conta por canal
--
-- Adiciona provider, displayName, identifier.
-- Migra @@unique de (workspaceId, channel) para (workspaceId, channel, identifier).
--
-- Apply: psql $DATABASE_URL -f prisma/migrations/manual_integration_credential_multi.sql
-- Idempotente — pode ser executado múltiplas vezes sem efeito colateral.
-- ============================================

BEGIN;

-- 1. Adicionar colunas novas (NULLABLE para não quebrar linhas existentes).
ALTER TABLE "IntegrationCredential"
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(30);

ALTER TABLE "IntegrationCredential"
  ADD COLUMN IF NOT EXISTS "displayName" VARCHAR(120);

ALTER TABLE "IntegrationCredential"
  ADD COLUMN IF NOT EXISTS "identifier" VARCHAR(255);

-- 2. Backfill provider para credenciais legadas:
--    - email_imap_smtp → 'custom' (vamos detectar Gmail/Outlook pelo host na UI)
--    - instagram      → 'meta'
--    - whatsapp       → 'evolution'
UPDATE "IntegrationCredential"
SET "provider" = CASE
  WHEN "channel" = 'email_imap_smtp' AND "provider" IS NULL THEN 'custom'
  WHEN "channel" = 'instagram'       AND "provider" IS NULL THEN 'meta'
  WHEN "channel" = 'whatsapp'        AND "provider" IS NULL THEN 'evolution'
  ELSE "provider"
END
WHERE "provider" IS NULL;

-- 3. Backfill identifier extraindo do config:
--    - email:     config->>'imapUser'
--    - instagram: config->>'pageId'
--    - whatsapp:  config->>'instanceName'
UPDATE "IntegrationCredential"
SET "identifier" = COALESCE(
  "config"->>'imapUser',
  "config"->>'pageId',
  "config"->>'instanceName',
  "id"  -- fallback: usar o próprio id se nada bater
)
WHERE "identifier" IS NULL;

-- 4. Backfill displayName a partir do identifier.
UPDATE "IntegrationCredential"
SET "displayName" = COALESCE("identifier", 'Conta sem nome')
WHERE "displayName" IS NULL;

-- 5. Substituir o unique antigo pelo novo, em transação:
--    drop antigo (se existir) → cria novo (se não existir).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'IntegrationCredential'
      AND indexname  = 'IntegrationCredential_workspaceId_channel_key'
  ) THEN
    EXECUTE 'ALTER TABLE "IntegrationCredential"
             DROP CONSTRAINT IF EXISTS "IntegrationCredential_workspaceId_channel_key"';
  END IF;
END
$$;

-- Criar unique novo se ainda não existir
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationCredential_workspaceId_channel_identifier_key"
  ON "IntegrationCredential" ("workspaceId", "channel", "identifier");

-- 6. Índice composto (workspaceId, channel, enabled) para queries do fetcher.
CREATE INDEX IF NOT EXISTS "IntegrationCredential_workspaceId_channel_enabled_idx"
  ON "IntegrationCredential" ("workspaceId", "channel", "enabled");

COMMIT;

-- ============================================
-- Rollback (se precisar voltar):
--
-- BEGIN;
--   DROP INDEX IF EXISTS "IntegrationCredential_workspaceId_channel_identifier_key";
--   DROP INDEX IF EXISTS "IntegrationCredential_workspaceId_channel_enabled_idx";
--   ALTER TABLE "IntegrationCredential"
--     ADD CONSTRAINT "IntegrationCredential_workspaceId_channel_key"
--     UNIQUE ("workspaceId", "channel");
--   ALTER TABLE "IntegrationCredential" DROP COLUMN IF EXISTS "identifier";
--   ALTER TABLE "IntegrationCredential" DROP COLUMN IF EXISTS "displayName";
--   ALTER TABLE "IntegrationCredential" DROP COLUMN IF EXISTS "provider";
-- COMMIT;
-- ============================================
