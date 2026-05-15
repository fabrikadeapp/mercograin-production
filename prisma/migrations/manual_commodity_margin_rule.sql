-- ============================================
-- CommodityMarginRule — margem padrão por workspace × commodity
--
-- Cliente cadastra em /configuracoes/fluxo-trabalho. Cada proposta nova
-- herda este % automaticamente; pode ser sobrescrito caso a caso.
--
-- Apply: psql $DATABASE_URL -f prisma/migrations/manual_commodity_margin_rule.sql
-- Idempotente — pode ser executado múltiplas vezes sem efeito colateral.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS "CommodityMarginRule" (
  "id"            TEXT PRIMARY KEY,
  "workspaceId"   TEXT NOT NULL,
  "commodity"     VARCHAR(40) NOT NULL,
  "margemPercent" DECIMAL(6,3) NOT NULL,
  "margemMinima"  DECIMAL(6,3),
  "observacoes"   TEXT,
  "ativa"         BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"     TEXT,

  CONSTRAINT "CommodityMarginRule_workspaceId_fkey"
    FOREIGN KEY ("workspaceId")
    REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommodityMarginRule_workspaceId_commodity_key"
  ON "CommodityMarginRule" ("workspaceId", "commodity");

CREATE INDEX IF NOT EXISTS "CommodityMarginRule_workspaceId_ativa_idx"
  ON "CommodityMarginRule" ("workspaceId", "ativa");

COMMIT;

-- ============================================
-- Rollback:
-- DROP TABLE "CommodityMarginRule";
-- ============================================
