-- F1-05 Corretagem completa: R$/tonelada, quem paga + rateio, status
-- prevista→faturada→recebida com aging, rateio entre múltiplos corretores.
-- Aditivo: colunas com default preservam apurações existentes.

BEGIN;

-- ComissaoRegra
ALTER TABLE "ComissaoRegra"
  ADD COLUMN IF NOT EXISTS "baseCalculo"          TEXT NOT NULL DEFAULT 'percentual',
  ADD COLUMN IF NOT EXISTS "valorPorTonelada"     DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS "quemPaga"             TEXT NOT NULL DEFAULT 'comprador',
  ADD COLUMN IF NOT EXISTS "rateioCompradorPct"   DOUBLE PRECISION NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "prazoRecebimentoDias" INTEGER NOT NULL DEFAULT 30;

-- ComissaoApurada
ALTER TABLE "ComissaoApurada"
  ADD COLUMN IF NOT EXISTS "baseCalculo"       TEXT NOT NULL DEFAULT 'percentual',
  ADD COLUMN IF NOT EXISTS "toneladas"         DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "valorPorTonelada"  DECIMAL(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "quemPaga"          TEXT NOT NULL DEFAULT 'comprador',
  ADD COLUMN IF NOT EXISTS "valorComprador"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "valorVendedorPaga" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "faturadaEm"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "vencimentoEm"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recebidaEm"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rateioCorretores"  JSONB;

CREATE INDEX IF NOT EXISTS "ComissaoApurada_ws_vencimento_idx"
  ON "ComissaoApurada"("workspaceId","vencimentoEm");

COMMIT;
