-- ============================================================================
-- BH Grain Lote 12 (Fase E) — Permissões granulares por perfil comercial
-- Adiciona coluna opcional commercialRole em WorkspaceMember.
-- 100% aditivo. Default null = comportamento atual preservado.
-- Reverter: ALTER TABLE "WorkspaceMember" DROP COLUMN IF EXISTS "commercialRole";
-- ============================================================================

ALTER TABLE "WorkspaceMember"
  ADD COLUMN IF NOT EXISTS "commercialRole" TEXT;
