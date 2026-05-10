-- Sprint S7 — M4 Logística PWA + CT-e/MDF-e + NFP-e + Dashboard execução
-- Idempotente: pode ser executada várias vezes sem erro.

-- ============================================================
-- Story 7.5: Avariados generic na Classificacao
-- ============================================================
ALTER TABLE "Classificacao"
  ADD COLUMN IF NOT EXISTS "avariadosGeral" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Classificacao"
  ADD COLUMN IF NOT EXISTS "descontoAvariadosPct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ============================================================
-- Story 7.6: Token público de romaneio (entrega no armazém)
-- ============================================================
ALTER TABLE "Romaneio"
  ADD COLUMN IF NOT EXISTS "qrTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "qrTokenExpiraEm" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Romaneio_qrTokenHash_idx" ON "Romaneio"("qrTokenHash");
