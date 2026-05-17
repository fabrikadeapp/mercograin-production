-- Feature flags por workspace (Onda 2)
-- Estratégia comercial: cada cliente compra os módulos que precisa.

BEGIN;

CREATE TABLE IF NOT EXISTS "WorkspaceFeature" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "feature"     VARCHAR(60) NOT NULL,
  "enabled"     BOOLEAN NOT NULL DEFAULT false,
  "enabledAt"   TIMESTAMP(3),
  "enabledBy"   TEXT,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceFeature_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceFeature_workspaceId_feature_key"
  ON "WorkspaceFeature"("workspaceId", "feature");

CREATE INDEX IF NOT EXISTS "WorkspaceFeature_feature_enabled_idx"
  ON "WorkspaceFeature"("feature", "enabled");

COMMIT;
