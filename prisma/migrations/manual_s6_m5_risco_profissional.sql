-- S6 M5 — Risco profissional (VaR, limites, breach, mesa/corretor)
-- Idempotente: usa IF NOT EXISTS / DROP IF EXISTS

-- ============================================================
-- 6.1 — Auditoria de cálculo MtM
-- ============================================================
ALTER TABLE "MarcacaoMercado"
  ADD COLUMN IF NOT EXISTS "inputsSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "calcMetodo" TEXT,
  ADD COLUMN IF NOT EXISTS "calcVersao" TEXT DEFAULT 'v1';

-- ============================================================
-- 6.5 — P&L hierárquico (mesa/corretor) — campos em PosicaoHedge / Contrato
-- ============================================================
ALTER TABLE "PosicaoHedge"
  ADD COLUMN IF NOT EXISTS "corretorId" TEXT,
  ADD COLUMN IF NOT EXISTS "mesaId" TEXT;

ALTER TABLE "Contrato"
  ADD COLUMN IF NOT EXISTS "corretorId" TEXT,
  ADD COLUMN IF NOT EXISTS "mesaId" TEXT;

CREATE INDEX IF NOT EXISTS "PosicaoHedge_corretorId_idx" ON "PosicaoHedge"("corretorId");
CREATE INDEX IF NOT EXISTS "PosicaoHedge_mesaId_idx" ON "PosicaoHedge"("mesaId");

-- ============================================================
-- Mesa
-- ============================================================
CREATE TABLE IF NOT EXISTS "Mesa" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Mesa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Mesa_workspaceId_ativo_idx" ON "Mesa"("workspaceId", "ativo");

DO $$ BEGIN
  ALTER TABLE "Mesa" ADD CONSTRAINT "Mesa_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Corretor
-- ============================================================
CREATE TABLE IF NOT EXISTS "Corretor" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "mesaId" TEXT,
  "nome" TEXT NOT NULL,
  "email" TEXT,
  "whatsapp" TEXT,
  "cpf" TEXT,
  "comissaoPct" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "comissaoOriginadorPct" DOUBLE PRECISION,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Corretor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Corretor_workspaceId_cpf_key" ON "Corretor"("workspaceId", "cpf");
CREATE INDEX IF NOT EXISTS "Corretor_workspaceId_ativo_idx" ON "Corretor"("workspaceId", "ativo");
CREATE INDEX IF NOT EXISTS "Corretor_mesaId_idx" ON "Corretor"("mesaId");
CREATE INDEX IF NOT EXISTS "Corretor_userId_idx" ON "Corretor"("userId");

DO $$ BEGIN
  ALTER TABLE "Corretor" ADD CONSTRAINT "Corretor_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Corretor" ADD CONSTRAINT "Corretor_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Corretor" ADD CONSTRAINT "Corretor_mesaId_fkey"
    FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- LimiteRisco
-- ============================================================
CREATE TABLE IF NOT EXISTS "LimiteRisco" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "escopo" TEXT NOT NULL,
  "escopoFiltro" JSONB,
  "tipo" TEXT NOT NULL,
  "valorMaximo" DECIMAL(15, 2) NOT NULL,
  "valorAviso" DECIMAL(15, 2),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "observacao" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LimiteRisco_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LimiteRisco_workspaceId_escopo_tipo_idx" ON "LimiteRisco"("workspaceId", "escopo", "tipo");
CREATE INDEX IF NOT EXISTS "LimiteRisco_workspaceId_ativo_idx" ON "LimiteRisco"("workspaceId", "ativo");

DO $$ BEGIN
  ALTER TABLE "LimiteRisco" ADD CONSTRAINT "LimiteRisco_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- LimiteBreach
-- ============================================================
CREATE TABLE IF NOT EXISTS "LimiteBreach" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "limiteId" TEXT NOT NULL,
  "valorAtual" DECIMAL(15, 2) NOT NULL,
  "valorMaximo" DECIMAL(15, 2) NOT NULL,
  "excedidoEm" DECIMAL(8, 2) NOT NULL,
  "severidade" TEXT NOT NULL,
  "detectadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvidoEm" TIMESTAMP(3),
  "triggerEntidade" TEXT,
  "triggerEntidadeId" TEXT,
  "triggerSnapshot" JSONB,
  "notificadoPor" JSONB,
  "observacao" TEXT,
  CONSTRAINT "LimiteBreach_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LimiteBreach_workspaceId_severidade_resolvidoEm_idx" ON "LimiteBreach"("workspaceId", "severidade", "resolvidoEm");
CREATE INDEX IF NOT EXISTS "LimiteBreach_limiteId_idx" ON "LimiteBreach"("limiteId");

DO $$ BEGIN
  ALTER TABLE "LimiteBreach" ADD CONSTRAINT "LimiteBreach_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LimiteBreach" ADD CONSTRAINT "LimiteBreach_limiteId_fkey"
    FOREIGN KEY ("limiteId") REFERENCES "LimiteRisco"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
