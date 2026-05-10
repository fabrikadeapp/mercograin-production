-- =====================================================================
-- S3 M3 — Assinatura digital + cláusulas + versionamento + marcos
-- Idempotente (use IF NOT EXISTS / DO blocks).
-- =====================================================================

-- 1) Contrato — campos novos
ALTER TABLE "Contrato"
  ADD COLUMN IF NOT EXISTS "templateVersaoSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "templateVersaoId"       TEXT,
  ADD COLUMN IF NOT EXISTS "formaPagamento"         TEXT,
  ADD COLUMN IF NOT EXISTS "prazoPagamentoDias"     INTEGER,
  ADD COLUMN IF NOT EXISTS "localEntrega"           TEXT;

-- 2) ContratoTemplate — versionamento
ALTER TABLE "ContratoTemplate"
  ADD COLUMN IF NOT EXISTS "versao" INTEGER NOT NULL DEFAULT 1;

-- 3) ContratoTemplateVersao
CREATE TABLE IF NOT EXISTS "ContratoTemplateVersao" (
  "id"          TEXT PRIMARY KEY,
  "templateId"  TEXT NOT NULL,
  "versao"      INTEGER NOT NULL,
  "contentJson" JSONB NOT NULL,
  "variaveis"   JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"   TEXT,
  "comentario"  TEXT,
  CONSTRAINT "ContratoTemplateVersao_template_fk"
    FOREIGN KEY ("templateId") REFERENCES "ContratoTemplate"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContratoTemplateVersao_templateId_versao_key"
  ON "ContratoTemplateVersao"("templateId", "versao");

-- 4) AssinaturaDigital
CREATE TABLE IF NOT EXISTS "AssinaturaDigital" (
  "id"              TEXT PRIMARY KEY,
  "workspaceId"     TEXT NOT NULL,
  "contratoId"      TEXT NOT NULL,
  "providerNome"    TEXT NOT NULL,
  "providerDocId"   TEXT NOT NULL,
  "authMode"        TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'pendente',
  "enviadoEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizadoEm"    TIMESTAMP(3),
  "expiraEm"        TIMESTAMP(3),
  "signatarios"     JSONB NOT NULL,
  "pdfOriginalHash" TEXT,
  "pdfAssinadoUrl"  TEXT,
  "pdfAssinadoHash" TEXT,
  "carimboTempo"    JSONB,
  "webhookSecret"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssinaturaDigital_workspace_fk"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "AssinaturaDigital_contrato_fk"
    FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AssinaturaDigital_contratoId_key"
  ON "AssinaturaDigital"("contratoId");
CREATE UNIQUE INDEX IF NOT EXISTS "AssinaturaDigital_providerDocId_key"
  ON "AssinaturaDigital"("providerDocId");
CREATE INDEX IF NOT EXISTS "AssinaturaDigital_workspace_status_idx"
  ON "AssinaturaDigital"("workspaceId", "status");

-- 5) ClausulaContrato
CREATE TABLE IF NOT EXISTS "ClausulaContrato" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "contratoId"  TEXT,
  "templateId"  TEXT,
  "ordem"       INTEGER NOT NULL,
  "tipo"        TEXT NOT NULL,
  "titulo"      TEXT NOT NULL,
  "texto"       TEXT NOT NULL,
  "obrigatoria" BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClausulaContrato_workspace_fk"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "ClausulaContrato_contrato_fk"
    FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE,
  CONSTRAINT "ClausulaContrato_template_fk"
    FOREIGN KEY ("templateId") REFERENCES "ContratoTemplate"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "ClausulaContrato_contratoId_idx" ON "ClausulaContrato"("contratoId");
CREATE INDEX IF NOT EXISTS "ClausulaContrato_templateId_idx" ON "ClausulaContrato"("templateId");

-- 6) ContratoNotificacao
CREATE TABLE IF NOT EXISTS "ContratoNotificacao" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "contratoId"  TEXT NOT NULL,
  "marco"       TEXT NOT NULL,
  "enviadoEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContratoNotificacao_workspace_fk"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "ContratoNotificacao_contrato_fk"
    FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContratoNotificacao_contratoId_marco_key"
  ON "ContratoNotificacao"("contratoId", "marco");
CREATE INDEX IF NOT EXISTS "ContratoNotificacao_workspace_idx"
  ON "ContratoNotificacao"("workspaceId");
