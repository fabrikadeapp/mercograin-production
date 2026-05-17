-- Numeração inteligente por workspace + dia.
-- Idempotente.

BEGIN;

-- Workspace.codigo
ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(8);

-- Tabela de contadores
CREATE TABLE IF NOT EXISTS "NumberingCounter" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "dia"         VARCHAR(10) NOT NULL,
  "tipo"        VARCHAR(2) NOT NULL,
  "ultimo"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NumberingCounter_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "NumberingCounter_workspaceId_dia_tipo_key"
  ON "NumberingCounter"("workspaceId", "dia", "tipo");

CREATE INDEX IF NOT EXISTS "NumberingCounter_workspaceId_idx"
  ON "NumberingCounter"("workspaceId");

-- Backfill: gera código (3 primeiras letras do nome em uppercase) onde está null
UPDATE "Workspace"
SET "codigo" = UPPER(SUBSTRING(REGEXP_REPLACE("name", '[^A-Za-z]', '', 'g') FROM 1 FOR 3))
WHERE "codigo" IS NULL AND "name" IS NOT NULL;

-- Fallback: workspaces sem letras suficientes ficam com 'WKS'
UPDATE "Workspace"
SET "codigo" = 'WKS'
WHERE "codigo" IS NULL OR LENGTH("codigo") < 3;

COMMIT;
