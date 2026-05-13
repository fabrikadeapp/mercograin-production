-- ============================================================================
-- BH Grain Lote 12 (Fase F) — Logística / Estoque / Qualidade na Proposta
-- 100% aditivo. Reaproveita Armazem e LoteEstoque já existentes.
-- Reverter: manual_bhgrain_l12_logistica_rollback.sql
-- ============================================================================

ALTER TABLE "Proposta"
  ADD COLUMN IF NOT EXISTS "origem"              VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "destino"             VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "localEntrega"        VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "modalTransporte"     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "freteTipo"           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "freteCustoTotal"     DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "freteCustoUnit"      DECIMAL(15,4),
  ADD COLUMN IF NOT EXISTS "prazoLogistico"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "incoterm"            VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "armazemOrigemRefId"  TEXT,
  ADD COLUMN IF NOT EXISTS "armazemDestinoRefId" TEXT,
  ADD COLUMN IF NOT EXISTS "loteEstoqueRefId"    TEXT,
  ADD COLUMN IF NOT EXISTS "qualidadeSpec"       JSONB;

CREATE INDEX IF NOT EXISTS "Proposta_armazemOrigemRefId_idx"  ON "Proposta"("armazemOrigemRefId");
CREATE INDEX IF NOT EXISTS "Proposta_armazemDestinoRefId_idx" ON "Proposta"("armazemDestinoRefId");
CREATE INDEX IF NOT EXISTS "Proposta_loteEstoqueRefId_idx"    ON "Proposta"("loteEstoqueRefId");

ALTER TABLE "Proposta"
  DROP CONSTRAINT IF EXISTS "Proposta_armazemOrigemRefId_fkey",
  ADD CONSTRAINT "Proposta_armazemOrigemRefId_fkey"
    FOREIGN KEY ("armazemOrigemRefId") REFERENCES "Armazem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Proposta"
  DROP CONSTRAINT IF EXISTS "Proposta_armazemDestinoRefId_fkey",
  ADD CONSTRAINT "Proposta_armazemDestinoRefId_fkey"
    FOREIGN KEY ("armazemDestinoRefId") REFERENCES "Armazem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Proposta"
  DROP CONSTRAINT IF EXISTS "Proposta_loteEstoqueRefId_fkey",
  ADD CONSTRAINT "Proposta_loteEstoqueRefId_fkey"
    FOREIGN KEY ("loteEstoqueRefId") REFERENCES "LoteEstoque"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
