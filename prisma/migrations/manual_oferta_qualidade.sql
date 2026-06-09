-- F1-02: qualidade + janela de entrega em Oferta (para o motor de match).
BEGIN;
ALTER TABLE "Oferta"
  ADD COLUMN IF NOT EXISTS "qualidadeSpec" JSONB,
  ADD COLUMN IF NOT EXISTS "janelaEntrega" TIMESTAMP(3);
COMMIT;
