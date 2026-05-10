-- Garante idempotência do cron diário: 1 cotação por (grão, dia/data exata)
-- O cron grava `data` truncado a UTC midnight, então este unique impede duplicatas
-- numa mesma rodada e permite upsert em re-runs.
CREATE UNIQUE INDEX IF NOT EXISTS "cotacao_grao_data_unique"
  ON "Cotacao" ("grao", "data");
