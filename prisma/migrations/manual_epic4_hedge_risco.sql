-- ============================================
-- Epic 4 — Hedge & Risco (Multi-moeda, Long/Short, NDF, MtM)
-- Manual migration (apply via `psql $DATABASE_URL -f <this file>`)
-- Idempotente: usa IF NOT EXISTS / DO $$ guards.
-- ============================================

BEGIN;

-- 1. Workspace.moedaPadrao
ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "moedaPadrao" TEXT NOT NULL DEFAULT 'BRL';

-- 2. PosicaoHedge
CREATE TABLE IF NOT EXISTS "PosicaoHedge" (
  "id"                    TEXT PRIMARY KEY,
  "workspaceId"           TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "numero"                TEXT NOT NULL,
  "tipo"                  TEXT NOT NULL,
  "cultura"               TEXT,
  "contratoFuturo"        TEXT NOT NULL,
  "vencimento"            TIMESTAMP(3) NOT NULL,
  "qtdContratos"          DOUBLE PRECISION NOT NULL,
  "qtdEquivalenteSc"      DOUBLE PRECISION NOT NULL,
  "precoEntradaUsdBu"     DECIMAL(10,4),
  "precoEntradaBrlSc"     DECIMAL(10,2),
  "cambioEntradaUsdBrl"   DECIMAL(10,4),
  "margemDepositadaUSD"   DECIMAL(15,2),
  "margemDepositadaBRL"   DECIMAL(15,2),
  "corretagemUSD"         DECIMAL(10,2) NOT NULL DEFAULT 0,
  "contratoOrigemId"      TEXT REFERENCES "Contrato"("id") ON DELETE SET NULL,
  "status"                TEXT NOT NULL DEFAULT 'aberta',
  "abertoEm"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechadoEm"             TIMESTAMP(3),
  "precoSaidaUsdBu"       DECIMAL(10,4),
  "precoSaidaBrlSc"       DECIMAL(10,2),
  "cambioSaidaUsdBrl"     DECIMAL(10,4),
  "pnlFinalUSD"           DECIMAL(15,2),
  "pnlFinalBRL"           DECIMAL(15,2),
  "observacoes"           TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PosicaoHedge_workspaceId_numero_key"
  ON "PosicaoHedge"("workspaceId", "numero");
CREATE INDEX IF NOT EXISTS "PosicaoHedge_workspaceId_status_idx"
  ON "PosicaoHedge"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "PosicaoHedge_cultura_vencimento_idx"
  ON "PosicaoHedge"("cultura", "vencimento");
CREATE INDEX IF NOT EXISTS "PosicaoHedge_contratoOrigemId_idx"
  ON "PosicaoHedge"("contratoOrigemId");

-- 3. NDF
CREATE TABLE IF NOT EXISTS "NDF" (
  "id"               TEXT PRIMARY KEY,
  "workspaceId"      TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "numero"           TEXT NOT NULL,
  "tipo"             TEXT NOT NULL,
  "contraparteNome"  TEXT NOT NULL,
  "contraparteCnpj"  TEXT,
  "direcao"          TEXT NOT NULL,
  "ativoTipo"        TEXT NOT NULL,
  "notional"         DECIMAL(15,2) NOT NULL,
  "strike"           DECIMAL(10,4) NOT NULL,
  "dataAbertura"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dataVencimento"   TIMESTAMP(3) NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'aberta',
  "precoLiquidacao"  DECIMAL(10,4),
  "resultadoBRL"     DECIMAL(15,2),
  "observacoes"      TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "NDF_workspaceId_numero_key"
  ON "NDF"("workspaceId", "numero");
CREATE INDEX IF NOT EXISTS "NDF_workspaceId_status_idx"
  ON "NDF"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "NDF_dataVencimento_idx"
  ON "NDF"("dataVencimento");

-- 4. MarcacaoMercado
CREATE TABLE IF NOT EXISTS "MarcacaoMercado" (
  "id"                 TEXT PRIMARY KEY,
  "workspaceId"        TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "posicaoHedgeId"     TEXT NOT NULL REFERENCES "PosicaoHedge"("id") ON DELETE CASCADE,
  "data"               TIMESTAMP(3) NOT NULL,
  "precoMercadoUsdBu"  DECIMAL(10,4),
  "precoMercadoBrlSc"  DECIMAL(10,2),
  "cambioUsdBrl"       DECIMAL(10,4),
  "pnlUnrealizedUSD"   DECIMAL(15,2) NOT NULL,
  "pnlUnrealizedBRL"   DECIMAL(15,2) NOT NULL,
  "variacaoDiaUSD"     DECIMAL(15,2),
  "variacaoDiaBRL"     DECIMAL(15,2),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarcacaoMercado_posicaoHedgeId_data_key"
  ON "MarcacaoMercado"("posicaoHedgeId", "data");
CREATE INDEX IF NOT EXISTS "MarcacaoMercado_workspaceId_data_idx"
  ON "MarcacaoMercado"("workspaceId", "data");

COMMIT;
