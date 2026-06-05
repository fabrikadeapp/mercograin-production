-- Fluxo: produtor pede cotação no portal -> corretora vê na caixa -> converte em Proposta.
CREATE TABLE IF NOT EXISTS "SolicitacaoCotacao" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "produtorAccessId" TEXT,
  "tipo" VARCHAR(10) NOT NULL DEFAULT 'venda',
  "grao" VARCHAR(40) NOT NULL,
  "quantidade" DECIMAL(14,2) NOT NULL,
  "unidade" VARCHAR(8) NOT NULL DEFAULT 't',
  "precoAlvo" DECIMAL(15,2),
  "prazoEntregaDias" INT,
  "localEntrega" VARCHAR(160),
  "observacao" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
  "propostaId" TEXT UNIQUE,
  "respondidoPorId" TEXT,
  "respondidoEm" TIMESTAMP(3),
  "motivoRecusa" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SolicitacaoCotacao_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "SolicitacaoCotacao_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "SolicitacaoCotacao_workspaceId_status_idx"
  ON "SolicitacaoCotacao"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "SolicitacaoCotacao_clienteId_idx"
  ON "SolicitacaoCotacao"("clienteId");
