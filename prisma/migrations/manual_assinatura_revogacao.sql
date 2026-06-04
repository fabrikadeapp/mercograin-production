-- N8 — Revogação de assinatura pelo staff antes de qualquer assinar
-- Vide docs/specs/assinaturapropriaonline.md §11

ALTER TABLE "AssinaturaDigital"
  ADD COLUMN IF NOT EXISTS "canceladoEm"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "canceladoPorId"  TEXT,
  ADD COLUMN IF NOT EXISTS "canceladoMotivo" TEXT;
