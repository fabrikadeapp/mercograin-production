-- F1 — Renegociação / Contra-oferta
-- Vincula propostas que são contra-ofertas de outras propostas + audit JSON
-- das mudanças propostas pelo cliente.

ALTER TABLE "Proposta"
  ADD COLUMN IF NOT EXISTS "propostaOriginalId" TEXT,
  ADD COLUMN IF NOT EXISTS "contraOfertaMudancas" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Proposta_propostaOriginalId_fkey'
  ) THEN
    ALTER TABLE "Proposta"
      ADD CONSTRAINT "Proposta_propostaOriginalId_fkey"
      FOREIGN KEY ("propostaOriginalId") REFERENCES "Proposta"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Proposta_propostaOriginalId_idx"
  ON "Proposta"("propostaOriginalId");
