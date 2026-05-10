-- S9 M7 — Fiscal: ECD/ECF + Guias DARF/GNRE/GARE
-- Idempotente: usar IF NOT EXISTS em tudo.

CREATE TABLE IF NOT EXISTS "Guia" (
  "id"                   TEXT PRIMARY KEY,
  "workspaceId"          TEXT NOT NULL,
  "numero"               TEXT NOT NULL,
  "tipo"                 TEXT NOT NULL,
  "codigoReceita"        TEXT NOT NULL,
  "contribuinteDoc"      TEXT NOT NULL,
  "contribuinteNome"     TEXT NOT NULL,
  "periodoApuracao"      TEXT NOT NULL,
  "valorPrincipal"       DECIMAL(15,2) NOT NULL,
  "multa"                DECIMAL(15,2) NOT NULL DEFAULT 0,
  "juros"                DECIMAL(15,2) NOT NULL DEFAULT 0,
  "valorTotal"           DECIMAL(15,2) NOT NULL,
  "vencimento"           TIMESTAMP(3) NOT NULL,
  "codigoBarras"         TEXT,
  "linhaDigitavel"       TEXT,
  "status"               TEXT NOT NULL DEFAULT 'aberto',
  "pagoEm"               TIMESTAMP(3),
  "uf"                   TEXT,
  "referenciaContratoId" TEXT,
  "observacoes"          TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Guia_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Guia_workspaceId_numero_key" ON "Guia"("workspaceId", "numero");
CREATE INDEX IF NOT EXISTS "Guia_workspaceId_tipo_status_idx" ON "Guia"("workspaceId", "tipo", "status");
CREATE INDEX IF NOT EXISTS "Guia_workspaceId_vencimento_idx"   ON "Guia"("workspaceId", "vencimento");

-- SpedExport.tipo passa a aceitar 'ecd' | 'ecf' (texto livre — comentário apenas).
COMMENT ON COLUMN "SpedExport"."tipo" IS 'fiscal | contribuicoes | ecd | ecf';
