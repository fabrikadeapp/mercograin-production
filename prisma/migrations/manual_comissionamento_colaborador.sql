-- Comissionamento de colaborador (vendedor interno) — feature 'comissionamento'.
-- Kill-switch global + por-workspace via sistema de features existente.
-- Nada é deletado: regras/apurações têm flag ativo/status (desativar, não apagar).

BEGIN;

-- 1. Flags no colaborador
ALTER TABLE "WorkspaceMember"
  ADD COLUMN IF NOT EXISTS "isVendedor"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "comissionado" BOOLEAN NOT NULL DEFAULT false;

-- 2. Regra de comissão individual (1:1 com WorkspaceMember)
CREATE TABLE IF NOT EXISTS "RegraComissaoColaborador" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "memberId"    TEXT NOT NULL,
  "tipo"        TEXT NOT NULL DEFAULT 'percentual',
  "pct"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "valorFixo"   DECIMAL(15,2),
  "baseFixo"    TEXT NOT NULL DEFAULT 'periodo',
  "faixas"      JSONB,
  "ativo"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegraComissaoColaborador_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RegraComissaoColaborador_memberId_key"
  ON "RegraComissaoColaborador"("memberId");
CREATE INDEX IF NOT EXISTS "RegraComissaoColaborador_workspaceId_idx"
  ON "RegraComissaoColaborador"("workspaceId");

-- 3. Comissão apurada por colaborador/período (snapshot imutável)
CREATE TABLE IF NOT EXISTS "ComissaoColaboradorApurada" (
  "id"            TEXT NOT NULL,
  "workspaceId"   TEXT NOT NULL,
  "memberId"      TEXT NOT NULL,
  "periodoInicio" TIMESTAMP(3) NOT NULL,
  "periodoFim"    TIMESTAMP(3) NOT NULL,
  "valorVendido"  DECIMAL(15,2) NOT NULL,
  "qtdContratos"  INTEGER NOT NULL DEFAULT 0,
  "tipoRegra"     TEXT NOT NULL,
  "regraSnapshot" JSONB,
  "valorComissao" DECIMAL(15,2) NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'prevista',
  "pagaEm"        TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComissaoColaboradorApurada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ComissaoColaboradorApurada_ws_member_periodo_key"
  ON "ComissaoColaboradorApurada"("workspaceId","memberId","periodoInicio","periodoFim");
CREATE INDEX IF NOT EXISTS "ComissaoColaboradorApurada_ws_status_idx"
  ON "ComissaoColaboradorApurada"("workspaceId","status");
CREATE INDEX IF NOT EXISTS "ComissaoColaboradorApurada_member_idx"
  ON "ComissaoColaboradorApurada"("memberId");

-- 4. FKs (idempotentes via checagem)
DO $$ BEGIN
  ALTER TABLE "RegraComissaoColaborador"
    ADD CONSTRAINT "RegraComissaoColaborador_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RegraComissaoColaborador"
    ADD CONSTRAINT "RegraComissaoColaborador_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoColaboradorApurada"
    ADD CONSTRAINT "ComissaoColaboradorApurada_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ComissaoColaboradorApurada"
    ADD CONSTRAINT "ComissaoColaboradorApurada_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
