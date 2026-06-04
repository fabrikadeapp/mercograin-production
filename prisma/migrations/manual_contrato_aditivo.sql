-- F5 — Aditivo de contrato
-- Permite criar um Contrato novo que modifica/complementa outro contrato base.
-- Use cases: aumento de volume, prorrogação de prazo, ajuste de preço.

ALTER TABLE "Contrato"
  ADD COLUMN IF NOT EXISTS "aditivoBaseId"        TEXT,
  ADD COLUMN IF NOT EXISTS "aditivoTipo"          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "aditivoMudancas"      JSONB,
  ADD COLUMN IF NOT EXISTS "aditivoJustificativa" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Contrato_aditivoBaseId_fkey'
  ) THEN
    ALTER TABLE "Contrato"
      ADD CONSTRAINT "Contrato_aditivoBaseId_fkey"
      FOREIGN KEY ("aditivoBaseId") REFERENCES "Contrato"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Contrato_aditivoBaseId_idx"
  ON "Contrato"("aditivoBaseId");
