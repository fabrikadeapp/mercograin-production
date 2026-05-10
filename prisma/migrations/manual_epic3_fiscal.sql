-- ============================================
-- Epic 3 — Fiscal (NF-e + SPED + Diferimento ICMS)
-- Manual migration (apply via `psql $DATABASE_URL -f <this file>`)
-- Idempotente: usa IF NOT EXISTS / DO $$ guards.
-- ============================================

BEGIN;

-- ============================================
-- 1. ConfiguracaoFiscal (1:1 com Workspace)
-- ============================================
CREATE TABLE IF NOT EXISTS "ConfiguracaoFiscal" (
  "id"                     TEXT PRIMARY KEY,
  "workspaceId"            TEXT NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "cnpjEmissor"            TEXT NOT NULL,
  "inscricaoEstadual"      TEXT,
  "inscricaoMunicipal"     TEXT,
  "regimeTributario"       TEXT NOT NULL,
  "cnae"                   TEXT,
  "providerNome"           TEXT NOT NULL DEFAULT 'mock',
  "providerCompanyId"      TEXT,
  "ambiente"               TEXT NOT NULL DEFAULT 'homologacao',
  "certificadoUrl"         TEXT,
  "certificadoVencimento"  TIMESTAMP(3),
  "certificadoAlias"       TEXT,
  "serieNFe"               INTEGER NOT NULL DEFAULT 1,
  "proximoNumeroNFe"       INTEGER NOT NULL DEFAULT 1,
  "serieNFeContingencia"   INTEGER,
  "cfopCompraProdutorPF"   TEXT NOT NULL DEFAULT '1102',
  "cfopCompraProdutorPJ"   TEXT NOT NULL DEFAULT '1102',
  "cfopVendaInterestadual" TEXT NOT NULL DEFAULT '6101',
  "cfopVendaIntraestadual" TEXT NOT NULL DEFAULT '5101',
  "funruralAplicar"        BOOLEAN NOT NULL DEFAULT TRUE,
  "funruralAliquota"       DOUBLE PRECISION NOT NULL DEFAULT 1.3,
  "cnaeSped"               TEXT,
  "ativo"                  BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. NotaFiscal
-- ============================================
CREATE TABLE IF NOT EXISTS "NotaFiscal" (
  "id"                  TEXT PRIMARY KEY,
  "workspaceId"         TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "configFiscalId"      TEXT NOT NULL REFERENCES "ConfiguracaoFiscal"("id") ON DELETE CASCADE,
  "tipo"                TEXT NOT NULL,
  "modelo"              TEXT NOT NULL DEFAULT '55',
  "serie"               INTEGER NOT NULL,
  "numero"              INTEGER NOT NULL,
  "chave"               TEXT UNIQUE,
  "protocolo"           TEXT,
  "status"              TEXT NOT NULL DEFAULT 'rascunho',
  "motivoRejeicao"      TEXT,
  "dataEmissao"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dataAutorizacao"     TIMESTAMP(3),
  "dataCancelamento"    TIMESTAMP(3),
  "contratoId"          TEXT REFERENCES "Contrato"("id") ON DELETE SET NULL,
  "romaneioId"          TEXT REFERENCES "Romaneio"("id") ON DELETE SET NULL,
  "emitenteCnpj"        TEXT NOT NULL,
  "emitenteNome"        TEXT NOT NULL,
  "emitenteUF"          TEXT NOT NULL,
  "destinatarioDoc"     TEXT NOT NULL,
  "destinatarioNome"    TEXT NOT NULL,
  "destinatarioUF"      TEXT NOT NULL,
  "destinatarioIE"      TEXT,
  "itens"               JSONB NOT NULL,
  "valorProdutos"       DECIMAL(15,2) NOT NULL,
  "valorICMS"           DECIMAL(15,2) NOT NULL DEFAULT 0,
  "valorPIS"            DECIMAL(15,2) NOT NULL DEFAULT 0,
  "valorCOFINS"         DECIMAL(15,2) NOT NULL DEFAULT 0,
  "valorFUNRURAL"       DECIMAL(15,2) NOT NULL DEFAULT 0,
  "valorFrete"          DECIMAL(15,2) NOT NULL DEFAULT 0,
  "valorOutros"         DECIMAL(15,2) NOT NULL DEFAULT 0,
  "valorTotal"          DECIMAL(15,2) NOT NULL,
  "cfopPrincipal"       TEXT NOT NULL,
  "naturezaOperacao"    TEXT NOT NULL,
  "finalidadeEmissao"   TEXT NOT NULL DEFAULT '1',
  "intermunicipal"      BOOLEAN NOT NULL DEFAULT FALSE,
  "interestadual"       BOOLEAN NOT NULL DEFAULT FALSE,
  "notaPaiId"           TEXT REFERENCES "NotaFiscal"("id") ON DELETE SET NULL,
  "diferimentoICMS"     BOOLEAN NOT NULL DEFAULT FALSE,
  "providerResponse"    JSONB,
  "providerNFeId"       TEXT,
  "xmlUrl"              TEXT,
  "danfeUrl"            TEXT,
  "observacoes"         TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotaFiscal_workspaceId_serie_numero_key" UNIQUE ("workspaceId", "serie", "numero")
);

CREATE INDEX IF NOT EXISTS "NotaFiscal_workspaceId_status_idx" ON "NotaFiscal"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "NotaFiscal_dataEmissao_idx"        ON "NotaFiscal"("dataEmissao");
CREATE INDEX IF NOT EXISTS "NotaFiscal_chave_idx"              ON "NotaFiscal"("chave");
CREATE INDEX IF NOT EXISTS "NotaFiscal_contratoId_idx"         ON "NotaFiscal"("contratoId");

-- ============================================
-- 3. CartaCorrecao
-- ============================================
CREATE TABLE IF NOT EXISTS "CartaCorrecao" (
  "id"             TEXT PRIMARY KEY,
  "workspaceId"    TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "notaFiscalId"   TEXT NOT NULL REFERENCES "NotaFiscal"("id") ON DELETE CASCADE,
  "sequencia"      INTEGER NOT NULL,
  "texto"          TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'rascunho',
  "protocolo"      TEXT,
  "motivo"         TEXT,
  "dataAceite"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartaCorrecao_notaFiscalId_sequencia_key" UNIQUE ("notaFiscalId", "sequencia")
);

-- ============================================
-- 4. SpedExport
-- ============================================
CREATE TABLE IF NOT EXISTS "SpedExport" (
  "id"              TEXT PRIMARY KEY,
  "workspaceId"     TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "tipo"            TEXT NOT NULL,
  "competencia"     TEXT NOT NULL,
  "arquivoUrl"      TEXT,
  "totalRegistros"  INTEGER NOT NULL DEFAULT 0,
  "status"          TEXT NOT NULL DEFAULT 'processando',
  "erroMsg"         TEXT,
  "hashArquivo"     TEXT,
  "geradoEm"        TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpedExport_workspaceId_tipo_competencia_key" UNIQUE ("workspaceId", "tipo", "competencia")
);

CREATE INDEX IF NOT EXISTS "SpedExport_workspaceId_idx" ON "SpedExport"("workspaceId");

COMMIT;
