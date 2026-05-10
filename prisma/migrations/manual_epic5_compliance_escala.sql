-- ============================================
-- Epic 5 — Compliance & Escala
-- Workflow de aprovação multi-nível, Centros de custo, Movimentos financeiros,
-- Conciliação OFX, Talhões, Royalties, statusAprovacao em Contrato.
--
-- Apply: psql $DATABASE_URL -f prisma/migrations/manual_epic5_compliance_escala.sql
-- Idempotente.
-- ============================================

BEGIN;

-- 0. Contrato.statusAprovacao
ALTER TABLE "Contrato"
  ADD COLUMN IF NOT EXISTS "statusAprovacao" TEXT NOT NULL DEFAULT 'aprovado';

-- 1. AprovacaoWorkflow
CREATE TABLE IF NOT EXISTS "AprovacaoWorkflow" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "nome"        TEXT NOT NULL,
  "descricao"   TEXT,
  "entidade"    TEXT NOT NULL,
  "condicao"    JSONB NOT NULL,
  "etapas"      JSONB NOT NULL,
  "slaHoras"    INTEGER NOT NULL DEFAULT 48,
  "ativo"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AprovacaoWorkflow_workspaceId_entidade_ativo_idx"
  ON "AprovacaoWorkflow"("workspaceId", "entidade", "ativo");

-- 2. Aprovacao
CREATE TABLE IF NOT EXISTS "Aprovacao" (
  "id"              TEXT PRIMARY KEY,
  "workspaceId"     TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "workflowId"      TEXT NOT NULL REFERENCES "AprovacaoWorkflow"("id") ON DELETE CASCADE,
  "entidadeTipo"    TEXT NOT NULL,
  "entidadeId"      TEXT NOT NULL,
  "snapshot"        JSONB NOT NULL,
  "etapaAtual"      INTEGER NOT NULL DEFAULT 1,
  "totalEtapas"     INTEGER NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'pendente',
  "solicitanteId"   TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "prazoEtapaAtual" TIMESTAMP(3) NOT NULL,
  "observacoes"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Aprovacao_workspaceId_status_etapaAtual_idx"
  ON "Aprovacao"("workspaceId", "status", "etapaAtual");
CREATE INDEX IF NOT EXISTS "Aprovacao_entidadeTipo_entidadeId_idx"
  ON "Aprovacao"("entidadeTipo", "entidadeId");

-- 3. AprovacaoDecisao
CREATE TABLE IF NOT EXISTS "AprovacaoDecisao" (
  "id"          TEXT PRIMARY KEY,
  "aprovacaoId" TEXT NOT NULL REFERENCES "Aprovacao"("id") ON DELETE CASCADE,
  "etapa"       INTEGER NOT NULL,
  "aprovadorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "decisao"     TEXT NOT NULL,
  "motivo"      TEXT,
  "decididoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AprovacaoDecisao_aprovacaoId_etapa_key"
  ON "AprovacaoDecisao"("aprovacaoId", "etapa");

-- 4. CentroCusto
CREATE TABLE IF NOT EXISTS "CentroCusto" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "codigo"      TEXT NOT NULL,
  "nome"        TEXT NOT NULL,
  "descricao"   TEXT,
  "paiId"       TEXT REFERENCES "CentroCusto"("id") ON DELETE SET NULL,
  "ativo"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CentroCusto_workspaceId_codigo_key"
  ON "CentroCusto"("workspaceId", "codigo");
CREATE INDEX IF NOT EXISTS "CentroCusto_workspaceId_ativo_idx"
  ON "CentroCusto"("workspaceId", "ativo");

-- 5. MovimentoFinanceiro
CREATE TABLE IF NOT EXISTS "MovimentoFinanceiro" (
  "id"            TEXT PRIMARY KEY,
  "workspaceId"   TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "data"          TIMESTAMP(3) NOT NULL,
  "tipo"          TEXT NOT NULL,
  "natureza"      TEXT NOT NULL,
  "valor"         DECIMAL(15,2) NOT NULL,
  "descricao"     TEXT NOT NULL,
  "centroCustoId" TEXT REFERENCES "CentroCusto"("id") ON DELETE SET NULL,
  "contratoId"    TEXT REFERENCES "Contrato"("id") ON DELETE SET NULL,
  "boletoId"      TEXT REFERENCES "Boleto"("id") ON DELETE SET NULL,
  "safraId"       TEXT REFERENCES "Safra"("id") ON DELETE SET NULL,
  "cultura"       TEXT,
  "conciliado"    BOOLEAN NOT NULL DEFAULT FALSE,
  "conciliadoEm"  TIMESTAMP(3),
  "ofxLineHash"   TEXT,
  "observacoes"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MovimentoFinanceiro_ofxLineHash_key"
  ON "MovimentoFinanceiro"("ofxLineHash");
CREATE INDEX IF NOT EXISTS "MovimentoFinanceiro_workspaceId_data_idx"
  ON "MovimentoFinanceiro"("workspaceId", "data");
CREATE INDEX IF NOT EXISTS "MovimentoFinanceiro_workspaceId_tipo_natureza_idx"
  ON "MovimentoFinanceiro"("workspaceId", "tipo", "natureza");
CREATE INDEX IF NOT EXISTS "MovimentoFinanceiro_centroCustoId_idx"
  ON "MovimentoFinanceiro"("centroCustoId");
CREATE INDEX IF NOT EXISTS "MovimentoFinanceiro_safraId_idx"
  ON "MovimentoFinanceiro"("safraId");

-- 6. Talhao
CREATE TABLE IF NOT EXISTS "Talhao" (
  "id"                       TEXT PRIMARY KEY,
  "workspaceId"              TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "produtorId"               TEXT NOT NULL REFERENCES "Cliente"("id") ON DELETE CASCADE,
  "nome"                     TEXT NOT NULL,
  "area"                     DOUBLE PRECISION NOT NULL,
  "cultura"                  TEXT,
  "safraId"                  TEXT REFERENCES "Safra"("id") ON DELETE SET NULL,
  "produtividadeEstimadaSc"  DOUBLE PRECISION,
  "produtividadeRealSc"      DOUBLE PRECISION,
  "latitude"                 DOUBLE PRECISION,
  "longitude"                DOUBLE PRECISION,
  "municipio"                TEXT,
  "uf"                       TEXT,
  "observacoes"              TEXT,
  "ativo"                    BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Talhao_workspaceId_produtorId_nome_key"
  ON "Talhao"("workspaceId", "produtorId", "nome");
CREATE INDEX IF NOT EXISTS "Talhao_workspaceId_ativo_idx"
  ON "Talhao"("workspaceId", "ativo");
CREATE INDEX IF NOT EXISTS "Talhao_safraId_idx"
  ON "Talhao"("safraId");

-- 7. Royalty
CREATE TABLE IF NOT EXISTS "Royalty" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "contratoId"  TEXT NOT NULL REFERENCES "Contrato"("id") ON DELETE CASCADE,
  "detentorId"  TEXT NOT NULL REFERENCES "Fornecedor"("id") ON DELETE RESTRICT,
  "cultivar"    TEXT NOT NULL,
  "qtdSc"       DOUBLE PRECISION NOT NULL,
  "valorPorSc"  DECIMAL(10,4) NOT NULL,
  "valorTotal"  DECIMAL(15,2) NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'apurado',
  "pagoEm"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Royalty_workspaceId_status_idx"
  ON "Royalty"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "Royalty_contratoId_idx"
  ON "Royalty"("contratoId");

COMMIT;
