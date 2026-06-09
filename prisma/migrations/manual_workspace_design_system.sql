-- Workspace.designSystem — tema visual (design system) escolhido pela corretora.
-- Aplicado a TODOS os usuários do workspace via data-theme no <html> (SSR).
-- Slugs válidos (lib/ui/design-systems.ts):
--   lime | terminal | linen | cognac | frost | graphite | paper | aurora | sand | arctic
-- Default 'lime' = NewDB v2 atual (mapeia o antigo tema 'phb').

BEGIN;

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "designSystem" TEXT NOT NULL DEFAULT 'lime';

-- Backfill defensivo: garante que workspaces existentes fiquem no tema atual.
UPDATE "Workspace"
  SET "designSystem" = 'lime'
  WHERE "designSystem" IS NULL OR "designSystem" = '';

COMMIT;
