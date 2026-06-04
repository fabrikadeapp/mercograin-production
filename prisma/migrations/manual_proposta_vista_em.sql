-- F3 — Status "vista pelo cliente"
-- Adiciona tracking de primeira visualização e contador de acessos.

ALTER TABLE "Proposta"
  ADD COLUMN IF NOT EXISTS "vistaEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "vistasCount" INTEGER NOT NULL DEFAULT 0;
