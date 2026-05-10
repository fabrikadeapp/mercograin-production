-- ============================================
-- EPIC 1 — Originação & Fixação
-- Migration manual (aplicar via psql ou Railway shell)
-- ============================================
--
-- Adiciona: ContratoFixacao, Fixacao, Adiantamento, BarterInsumo,
--           PlanoVendas, Washout
-- Altera : Contrato (modalidade, contratoOriginalId)
--
-- IDempotente: usa IF NOT EXISTS / DO $$ BEGIN ... EXCEPTION quando aplicável.
-- ============================================

BEGIN;

-- ---- Contrato: novos campos ----------------------------------------------
ALTER TABLE "Contrato"
  ADD COLUMN IF NOT EXISTS "modalidade" TEXT NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS "contratoOriginalId" TEXT;

-- FK self-reference (operação triangular)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Contrato_contratoOriginalId_fkey'
  ) THEN
    ALTER TABLE "Contrato"
      ADD CONSTRAINT "Contrato_contratoOriginalId_fkey"
      FOREIGN KEY ("contratoOriginalId") REFERENCES "Contrato"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Contrato_contratoOriginalId_idx"
  ON "Contrato"("contratoOriginalId");

-- ---- ContratoFixacao -----------------------------------------------------
CREATE TABLE IF NOT EXISTS "ContratoFixacao" (
  "id"                TEXT PRIMARY KEY,
  "workspaceId"       TEXT NOT NULL,
  "contratoId"        TEXT NOT NULL UNIQUE,
  "modalidade"        TEXT NOT NULL,
  "qtdTotalSc"        DOUBLE PRECISION NOT NULL,
  "qtdFixadaSc"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "qtdRemanescenteSc" DOUBLE PRECISION NOT NULL,
  "fixacaoInicio"     TIMESTAMP(3),
  "fixacaoFim"        TIMESTAMP(3),
  "gatilhoTipo"       TEXT,
  "gatilhoPrecoSc"    DOUBLE PRECISION,
  "gatilhoCultura"    TEXT,
  "statusFixacao"     TEXT NOT NULL DEFAULT 'pendente',
  "observacoes"       TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContratoFixacao_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "ContratoFixacao_contratoId_fkey"
    FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ContratoFixacao_workspaceId_statusFixacao_idx"
  ON "ContratoFixacao"("workspaceId","statusFixacao");

-- ---- Fixacao --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Fixacao" (
  "id"                TEXT PRIMARY KEY,
  "workspaceId"       TEXT NOT NULL,
  "contratoFixacaoId" TEXT NOT NULL,
  "qtdSc"             DOUBLE PRECISION NOT NULL,
  "precoSc"           DOUBLE PRECISION NOT NULL,
  "precoUSDSc"        DOUBLE PRECISION,
  "cotacaoUSDBRL"     DOUBLE PRECISION,
  "premio"            DOUBLE PRECISION,
  "base"              DOUBLE PRECISION,
  "fixadoEm"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fixadoPor"         TEXT,
  "observacoes"       TEXT,
  "pdfUrl"            TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Fixacao_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "Fixacao_contratoFixacaoId_fkey"
    FOREIGN KEY ("contratoFixacaoId") REFERENCES "ContratoFixacao"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Fixacao_contratoFixacaoId_fixadoEm_idx"
  ON "Fixacao"("contratoFixacaoId","fixadoEm");
CREATE INDEX IF NOT EXISTS "Fixacao_workspaceId_idx" ON "Fixacao"("workspaceId");

-- ---- Adiantamento ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Adiantamento" (
  "id"                TEXT PRIMARY KEY,
  "workspaceId"       TEXT NOT NULL,
  "numero"            TEXT NOT NULL,
  "contratoId"        TEXT NOT NULL,
  "produtorId"        TEXT NOT NULL,
  "valor"             DECIMAL(15,2) NOT NULL,
  "tipo"              TEXT NOT NULL,
  "dataAdiantamento"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dataPrevistaQuit"  TIMESTAMP(3),
  "qtdAbatidaSc"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "qtdEsperadaSc"     DOUBLE PRECISION NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'aberto',
  "observacoes"       TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Adiantamento_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "Adiantamento_contratoId_fkey"
    FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE,
  CONSTRAINT "Adiantamento_produtorId_fkey"
    FOREIGN KEY ("produtorId") REFERENCES "Cliente"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS "Adiantamento_workspaceId_numero_key"
  ON "Adiantamento"("workspaceId","numero");
CREATE INDEX IF NOT EXISTS "Adiantamento_workspaceId_status_idx"
  ON "Adiantamento"("workspaceId","status");
CREATE INDEX IF NOT EXISTS "Adiantamento_produtorId_idx"
  ON "Adiantamento"("produtorId");
CREATE INDEX IF NOT EXISTS "Adiantamento_contratoId_idx"
  ON "Adiantamento"("contratoId");

-- ---- BarterInsumo ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "BarterInsumo" (
  "id"                   TEXT PRIMARY KEY,
  "workspaceId"          TEXT NOT NULL,
  "adiantamentoId"       TEXT,
  "contratoId"           TEXT NOT NULL,
  "descricao"            TEXT NOT NULL,
  "fornecedorId"         TEXT,
  "quantidade"           DOUBLE PRECISION NOT NULL,
  "unidade"              TEXT NOT NULL,
  "precoUnit"            DECIMAL(10,2) NOT NULL,
  "valorTotal"           DECIMAL(15,2) NOT NULL,
  "precoFixadoSc"        DOUBLE PRECISION NOT NULL,
  "qtdGraoEquivalenteSc" DOUBLE PRECISION NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'pendente',
  "dataEntregaInsumo"    TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BarterInsumo_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "BarterInsumo_adiantamentoId_fkey"
    FOREIGN KEY ("adiantamentoId") REFERENCES "Adiantamento"("id") ON DELETE SET NULL,
  CONSTRAINT "BarterInsumo_contratoId_fkey"
    FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE,
  CONSTRAINT "BarterInsumo_fornecedorId_fkey"
    FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "BarterInsumo_workspaceId_status_idx"
  ON "BarterInsumo"("workspaceId","status");
CREATE INDEX IF NOT EXISTS "BarterInsumo_contratoId_idx"
  ON "BarterInsumo"("contratoId");
CREATE INDEX IF NOT EXISTS "BarterInsumo_adiantamentoId_idx"
  ON "BarterInsumo"("adiantamentoId");
CREATE INDEX IF NOT EXISTS "BarterInsumo_fornecedorId_idx"
  ON "BarterInsumo"("fornecedorId");

-- ---- PlanoVendas ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PlanoVendas" (
  "id"                   TEXT PRIMARY KEY,
  "workspaceId"          TEXT NOT NULL,
  "safraId"              TEXT,
  "cultura"              TEXT NOT NULL,
  "qtdPrevistaSc"        DOUBLE PRECISION NOT NULL,
  "qtdContratadaSc"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "qtdFixadaSc"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "qtdEntregueSc"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "precoMedioPrevistoSc" DOUBLE PRECISION,
  "observacoes"          TEXT,
  "status"               TEXT NOT NULL DEFAULT 'ativo',
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanoVendas_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "PlanoVendas_safraId_fkey"
    FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanoVendas_workspaceId_cultura_safraId_key"
  ON "PlanoVendas"("workspaceId","cultura","safraId");
CREATE INDEX IF NOT EXISTS "PlanoVendas_workspaceId_status_idx"
  ON "PlanoVendas"("workspaceId","status");

-- ---- Washout --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Washout" (
  "id"               TEXT PRIMARY KEY,
  "workspaceId"      TEXT NOT NULL,
  "contratoId"       TEXT NOT NULL,
  "motivo"           TEXT NOT NULL,
  "motivoDescricao"  TEXT,
  "custoWashout"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  "custoQuemPaga"    TEXT,
  "qtdAfetadaSc"     DOUBLE PRECISION NOT NULL,
  "aprovadoPor"      TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Washout_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "Washout_contratoId_fkey"
    FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Washout_workspaceId_idx" ON "Washout"("workspaceId");
CREATE INDEX IF NOT EXISTS "Washout_contratoId_idx" ON "Washout"("contratoId");

COMMIT;

-- Verificar:
-- SELECT modalidade, COUNT(*) FROM "Contrato" GROUP BY 1;
-- SELECT * FROM "ContratoFixacao" LIMIT 5;
