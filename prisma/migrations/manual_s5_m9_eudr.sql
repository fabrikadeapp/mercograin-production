-- S5 M9 — EUDR: cadeia de custódia + DDS + áreas protegidas
-- Idempotente: pode ser executada múltiplas vezes sem efeito colateral.

-- 1) TalhaoLote (cadeia de custódia N:M Talhao <-> LoteEstoque)
CREATE TABLE IF NOT EXISTS "TalhaoLote" (
  "id"              TEXT PRIMARY KEY,
  "workspaceId"     TEXT NOT NULL,
  "talhaoId"        TEXT NOT NULL,
  "loteId"          TEXT NOT NULL,
  "qtdSc"           DOUBLE PRECISION NOT NULL,
  "ticketBalancaId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TalhaoLote_workspaceId_fkey"     FOREIGN KEY ("workspaceId")     REFERENCES "Workspace"("id")     ON DELETE CASCADE,
  CONSTRAINT "TalhaoLote_talhaoId_fkey"        FOREIGN KEY ("talhaoId")        REFERENCES "Talhao"("id")        ON DELETE CASCADE,
  CONSTRAINT "TalhaoLote_loteId_fkey"          FOREIGN KEY ("loteId")          REFERENCES "LoteEstoque"("id")   ON DELETE CASCADE,
  CONSTRAINT "TalhaoLote_ticketBalancaId_fkey" FOREIGN KEY ("ticketBalancaId") REFERENCES "TicketBalanca"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "TalhaoLote_talhaoId_loteId_ticketBalancaId_key"
  ON "TalhaoLote"("talhaoId","loteId","ticketBalancaId");
CREATE INDEX IF NOT EXISTS "TalhaoLote_workspaceId_idx" ON "TalhaoLote"("workspaceId");
CREATE INDEX IF NOT EXISTS "TalhaoLote_loteId_idx"      ON "TalhaoLote"("loteId");
CREATE INDEX IF NOT EXISTS "TalhaoLote_talhaoId_idx"    ON "TalhaoLote"("talhaoId");

-- 2) AreaProtegida (catálogo TI/UC/embargo)
CREATE TABLE IF NOT EXISTS "AreaProtegida" (
  "id"           TEXT PRIMARY KEY,
  "tipo"         TEXT NOT NULL,
  "nome"         TEXT NOT NULL,
  "uf"           TEXT,
  "geoJson"      JSONB NOT NULL,
  "centroideLat" DOUBLE PRECISION,
  "centroideLng" DOUBLE PRECISION,
  "bboxJson"     JSONB,
  "fonte"        TEXT NOT NULL,
  "fonteUrl"     TEXT,
  "importadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AreaProtegida_tipo_uf_idx" ON "AreaProtegida"("tipo","uf");

-- 3) DueDiligenceStatement
CREATE TABLE IF NOT EXISTS "DueDiligenceStatement" (
  "id"                 TEXT PRIMARY KEY,
  "workspaceId"        TEXT NOT NULL,
  "numero"             TEXT NOT NULL,
  "contratoId"         TEXT,
  "operadorNome"       TEXT NOT NULL,
  "operadorCnpj"       TEXT NOT NULL,
  "operadorEndereco"   TEXT NOT NULL,
  "cultura"            TEXT NOT NULL,
  "ncm"                TEXT NOT NULL,
  "qtdToneladas"       DOUBLE PRECISION NOT NULL,
  "propriedadesOrigem" JSONB NOT NULL,
  "lotesEnvolvidos"    JSONB NOT NULL,
  "riscoNivel"         TEXT NOT NULL,
  "riscoFatores"       JSONB NOT NULL,
  "atestadoPor"        TEXT,
  "atestadoEm"         TIMESTAMP(3),
  "conclusao"          TEXT NOT NULL DEFAULT 'rascunho',
  "pdfUrl"             TEXT,
  "pdfHash"            TEXT,
  "eudrSubmissionId"   TEXT,
  "eudrSubmittedAt"    TIMESTAMP(3),
  "observacoes"        TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DueDiligenceStatement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "DueDiligenceStatement_contratoId_fkey"  FOREIGN KEY ("contratoId")  REFERENCES "Contrato"("id")  ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "DueDiligenceStatement_workspaceId_numero_key"
  ON "DueDiligenceStatement"("workspaceId","numero");
CREATE INDEX IF NOT EXISTS "DueDiligenceStatement_workspaceId_conclusao_idx"
  ON "DueDiligenceStatement"("workspaceId","conclusao");
CREATE INDEX IF NOT EXISTS "DueDiligenceStatement_contratoId_idx"
  ON "DueDiligenceStatement"("contratoId");
