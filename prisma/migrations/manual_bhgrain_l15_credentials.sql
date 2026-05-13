-- ============================================================================
-- BH Grain Lote 15 — Credenciais de integração por workspace × canal
-- 100% aditivo. Reverter: DROP TABLE "IntegrationCredential";
-- ============================================================================

CREATE TABLE IF NOT EXISTS "IntegrationCredential" (
  "id"               TEXT PRIMARY KEY,
  "workspaceId"      TEXT NOT NULL,
  "channel"          VARCHAR(30) NOT NULL,
  "config"           JSONB NOT NULL,
  "secretsEncrypted" JSONB NOT NULL,
  "enabled"          BOOLEAN NOT NULL DEFAULT false,
  "lastTestedAt"     TIMESTAMP(3),
  "lastTestSuccess"  BOOLEAN,
  "lastTestError"    TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  "createdBy"        TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationCredential_workspaceId_channel_key"
  ON "IntegrationCredential"("workspaceId", "channel");

CREATE INDEX IF NOT EXISTS "IntegrationCredential_workspaceId_enabled_idx"
  ON "IntegrationCredential"("workspaceId", "enabled");

ALTER TABLE "IntegrationCredential"
  DROP CONSTRAINT IF EXISTS "IntegrationCredential_workspaceId_fkey",
  ADD CONSTRAINT "IntegrationCredential_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
