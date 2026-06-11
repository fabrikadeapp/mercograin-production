-- Simulador CBOT — automação de dados.
--
-- 1) Cotacao.cbotCents: futuro CBOT (Chicago) em centavos de dólar por bushel,
--    persistido pelo cron diário (fonte Yahoo Finance ZS=F/ZC=F/ZW=F).
--    Distinto de Cotacao.preco, que é CEPEA R$/saca60.
-- 2) SimuladorConfig: parâmetros da mesa por workspace (FOBBINGS, prêmios por
--    trading, fretes por praça) — evita redigitar a cada simulação.
--
-- Idempotente. Aplicar via:
--   railway run npx prisma db execute --file prisma/migrations/manual_simulador_cbot.sql --schema prisma/schema.prisma

BEGIN;

-- 1) CBOT ¢/bu no snapshot diário de cotação
ALTER TABLE "Cotacao"
  ADD COLUMN IF NOT EXISTS "cbotCents" DECIMAL(10, 2);

-- 2) Config do simulador por workspace
CREATE TABLE IF NOT EXISTS "SimuladorConfig" (
  "id"             TEXT NOT NULL,
  "workspaceId"    TEXT NOT NULL,
  "fobbingsUsdTon" DECIMAL(10, 2) NOT NULL DEFAULT -10,
  "tradings"       JSONB NOT NULL DEFAULT '[]',
  "pracas"         JSONB NOT NULL DEFAULT '[]',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimuladorConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SimuladorConfig_workspaceId_key"
  ON "SimuladorConfig" ("workspaceId");

-- FK para Workspace (cascade no delete do workspace). Idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SimuladorConfig_workspaceId_fkey'
  ) THEN
    ALTER TABLE "SimuladorConfig"
      ADD CONSTRAINT "SimuladorConfig_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
