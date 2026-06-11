-- Simulador CBOT — data/hora real da atualização dos dados.
--
-- Cotacao.data e TaxaCambio.data são truncados à meia-noite UTC pelo cron
-- (chave única por dia), então não carregam a HORA da sincronização. Adiciona
-- `updatedAt` (timestamp real da última gravação) para exibir "atualizado em
-- DD/MM/AAAA HH:mm" no simulador.
--
-- Idempotente. Aplicar via:
--   railway run npx prisma db execute --file prisma/migrations/manual_cotacao_updatedat.sql --schema prisma/schema.prisma

BEGIN;

-- Cotacao.updatedAt
ALTER TABLE "Cotacao"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Backfill: registros antigos recebem ao menos a data do dia como referência.
UPDATE "Cotacao" SET "updatedAt" = "data" WHERE "updatedAt" < "data";

-- TaxaCambio.updatedAt
ALTER TABLE "TaxaCambio"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "TaxaCambio" SET "updatedAt" = "data" WHERE "updatedAt" < "data";

COMMIT;
