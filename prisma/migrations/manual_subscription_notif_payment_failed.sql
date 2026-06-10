-- Dunning: marca a última vez que avisamos o owner de pagamento falho (past_due).
-- Usado para idempotência — não reenvia o aviso enquanto não houver um novo
-- ciclo de cobrança falha (resetado em invoice.payment_succeeded).

BEGIN;

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "notifPaymentFailedAt" TIMESTAMP(3);

COMMIT;
