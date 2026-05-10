-- S8 M6 — Comissão hierárquica
-- Idempotente. Aplicar manualmente após revisão.

CREATE TABLE IF NOT EXISTS "ComissaoRegra" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "escopoTipo" TEXT,
  "escopoFiltro" JSONB,
  "pctTotal" DOUBLE PRECISION NOT NULL,
  "pctCorretor" DOUBLE PRECISION NOT NULL,
  "pctOriginador" DOUBLE PRECISION,
  "pctMesa" DOUBLE PRECISION,
  "pctHouse" DOUBLE PRECISION,
  "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
  "prioridade" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComissaoRegra_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ComissaoRegra_workspace_ativo_prio_idx"
  ON "ComissaoRegra"("workspaceId", "ativo", "prioridade");

CREATE TABLE IF NOT EXISTS "ComissaoApurada" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "contratoId" TEXT NOT NULL UNIQUE,
  "regraId" TEXT,
  "valorContrato" DECIMAL(15,2) NOT NULL,
  "pctTotalAplicado" DOUBLE PRECISION NOT NULL,
  "valorTotalComissao" DECIMAL(15,2) NOT NULL,
  "corretorId" TEXT,
  "valorCorretor" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "originadorId" TEXT,
  "valorOriginador" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "mesaId" TEXT,
  "valorMesa" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "valorHouse" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'apurada',
  "pagaEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComissaoApurada_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "ComissaoApurada_regraId_fkey"
    FOREIGN KEY ("regraId") REFERENCES "ComissaoRegra"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ComissaoApurada_workspace_status_idx"
  ON "ComissaoApurada"("workspaceId", "status");

CREATE INDEX IF NOT EXISTS "ComissaoApurada_corretor_idx"
  ON "ComissaoApurada"("corretorId");
