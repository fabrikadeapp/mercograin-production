-- ============================================
-- Epic 2 — Operação Física
-- Aplique manualmente em prod via DATABASE_PUBLIC_URL.
-- Idempotente: usa IF NOT EXISTS onde possível.
-- ============================================

-- Safra
CREATE TABLE IF NOT EXISTS "Safra" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "cultura" TEXT NOT NULL,
  "inicio" TIMESTAMP(3) NOT NULL,
  "fim" TIMESTAMP(3) NOT NULL,
  "ativa" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Safra_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Safra_workspaceId_nome_cultura_key"
  ON "Safra"("workspaceId","nome","cultura");
CREATE INDEX IF NOT EXISTS "Safra_workspaceId_ativa_idx"
  ON "Safra"("workspaceId","ativa");

-- TabelaClassificacao
CREATE TABLE IF NOT EXISTS "TabelaClassificacao" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "cultura" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "umidadePadrao" DOUBLE PRECISION NOT NULL,
  "umidadeMaxima" DOUBLE PRECISION NOT NULL,
  "impurezaPadrao" DOUBLE PRECISION NOT NULL,
  "impurezaMaxima" DOUBLE PRECISION NOT NULL,
  "ardidosMaximo" DOUBLE PRECISION NOT NULL,
  "quebradosMaximo" DOUBLE PRECISION NOT NULL,
  "esverdeadosMaximo" DOUBLE PRECISION,
  "pesoHectolitroMin" DOUBLE PRECISION,
  "fatorDescontoUmidade" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "fatorDescontoImpureza" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "fatorDescontoArdidos" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
  "fatorDescontoQuebrados" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TabelaClassificacao_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TabelaClassificacao_workspaceId_cultura_nome_key"
  ON "TabelaClassificacao"("workspaceId","cultura","nome");
CREATE INDEX IF NOT EXISTS "TabelaClassificacao_workspaceId_cultura_ativo_idx"
  ON "TabelaClassificacao"("workspaceId","cultura","ativo");

-- Balanca
CREATE TABLE IF NOT EXISTS "Balanca" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "modelo" TEXT,
  "fabricante" TEXT,
  "armazemId" TEXT,
  "capacidadeMaxKg" INTEGER NOT NULL DEFAULT 80000,
  "precisaoKg" INTEGER NOT NULL DEFAULT 20,
  "tipoIntegracao" TEXT NOT NULL DEFAULT 'manual',
  "enderecoIntegracao" TEXT,
  "ativa" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Balanca_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "Balanca_armazemId_fkey"
    FOREIGN KEY ("armazemId") REFERENCES "Armazem"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "Balanca_workspaceId_ativa_idx"
  ON "Balanca"("workspaceId","ativa");
CREATE INDEX IF NOT EXISTS "Balanca_armazemId_idx" ON "Balanca"("armazemId");

-- LoteEstoque
CREATE TABLE IF NOT EXISTS "LoteEstoque" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "cultura" TEXT NOT NULL,
  "safraId" TEXT,
  "armazemId" TEXT NOT NULL,
  "qtdInicialSc" DOUBLE PRECISION NOT NULL,
  "qtdAtualSc" DOUBLE PRECISION NOT NULL,
  "umidadeMedia" DOUBLE PRECISION,
  "impurezaMedia" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'ativo',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoteEstoque_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "LoteEstoque_safraId_fkey"
    FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE SET NULL,
  CONSTRAINT "LoteEstoque_armazemId_fkey"
    FOREIGN KEY ("armazemId") REFERENCES "Armazem"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoteEstoque_workspaceId_numero_key"
  ON "LoteEstoque"("workspaceId","numero");
CREATE INDEX IF NOT EXISTS "LoteEstoque_workspaceId_cultura_status_idx"
  ON "LoteEstoque"("workspaceId","cultura","status");
CREATE INDEX IF NOT EXISTS "LoteEstoque_armazemId_idx" ON "LoteEstoque"("armazemId");

-- Romaneio
CREATE TABLE IF NOT EXISTS "Romaneio" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "contratosIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "motoristaId" TEXT,
  "origem" TEXT NOT NULL,
  "destino" TEXT NOT NULL,
  "cultura" TEXT NOT NULL,
  "safraId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'rascunho',
  "dataSaida" TIMESTAMP(3),
  "dataChegada" TIMESTAMP(3),
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Romaneio_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "Romaneio_motoristaId_fkey"
    FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL,
  CONSTRAINT "Romaneio_safraId_fkey"
    FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Romaneio_workspaceId_numero_key"
  ON "Romaneio"("workspaceId","numero");
CREATE INDEX IF NOT EXISTS "Romaneio_workspaceId_status_idx"
  ON "Romaneio"("workspaceId","status");
CREATE INDEX IF NOT EXISTS "Romaneio_motoristaId_idx" ON "Romaneio"("motoristaId");

-- Classificacao
CREATE TABLE IF NOT EXISTS "Classificacao" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "cultura" TEXT NOT NULL,
  "umidade" DOUBLE PRECISION NOT NULL,
  "impureza" DOUBLE PRECISION NOT NULL,
  "ardidos" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "quebrados" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "esverdeados" DOUBLE PRECISION,
  "pesoHectolitroKg" DOUBLE PRECISION,
  "tabelaId" TEXT,
  "descontoUmidadePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "descontoImpurezaPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "descontoArdidosPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "descontoQuebradosPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "descontoTotalPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pesoLiquidoFinalKg" DOUBLE PRECISION,
  "classificadoPor" TEXT,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Classificacao_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Classificacao_workspaceId_cultura_idx"
  ON "Classificacao"("workspaceId","cultura");

-- TicketBalanca
CREATE TABLE IF NOT EXISTS "TicketBalanca" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "romaneioId" TEXT,
  "balancaId" TEXT,
  "loteId" TEXT,
  "pesoBrutoKg" DOUBLE PRECISION NOT NULL,
  "taraKg" DOUBLE PRECISION NOT NULL,
  "pesoLiquidoKg" DOUBLE PRECISION NOT NULL,
  "cultura" TEXT NOT NULL,
  "safraId" TEXT,
  "classificacaoId" TEXT,
  "placa" TEXT,
  "motoristaId" TEXT,
  "fotoUrl" TEXT,
  "observacoes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'aberto',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketBalanca_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "TicketBalanca_romaneioId_fkey"
    FOREIGN KEY ("romaneioId") REFERENCES "Romaneio"("id") ON DELETE SET NULL,
  CONSTRAINT "TicketBalanca_balancaId_fkey"
    FOREIGN KEY ("balancaId") REFERENCES "Balanca"("id") ON DELETE SET NULL,
  CONSTRAINT "TicketBalanca_loteId_fkey"
    FOREIGN KEY ("loteId") REFERENCES "LoteEstoque"("id") ON DELETE SET NULL,
  CONSTRAINT "TicketBalanca_safraId_fkey"
    FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE SET NULL,
  CONSTRAINT "TicketBalanca_classificacaoId_fkey"
    FOREIGN KEY ("classificacaoId") REFERENCES "Classificacao"("id") ON DELETE SET NULL,
  CONSTRAINT "TicketBalanca_motoristaId_fkey"
    FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "TicketBalanca_workspaceId_numero_key"
  ON "TicketBalanca"("workspaceId","numero");
CREATE INDEX IF NOT EXISTS "TicketBalanca_workspaceId_status_tipo_idx"
  ON "TicketBalanca"("workspaceId","status","tipo");
CREATE INDEX IF NOT EXISTS "TicketBalanca_romaneioId_idx" ON "TicketBalanca"("romaneioId");
CREATE INDEX IF NOT EXISTS "TicketBalanca_loteId_idx" ON "TicketBalanca"("loteId");

-- MovimentacaoLote
CREATE TABLE IF NOT EXISTS "MovimentacaoLote" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "loteId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "qtdSc" DOUBLE PRECISION NOT NULL,
  "armazemDestinoId" TEXT,
  "ticketBalancaId" TEXT,
  "contratoId" TEXT,
  "motivo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MovimentacaoLote_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "MovimentacaoLote_loteId_fkey"
    FOREIGN KEY ("loteId") REFERENCES "LoteEstoque"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "MovimentacaoLote_workspaceId_loteId_idx"
  ON "MovimentacaoLote"("workspaceId","loteId");
CREATE INDEX IF NOT EXISTS "MovimentacaoLote_tipo_idx" ON "MovimentacaoLote"("tipo");
