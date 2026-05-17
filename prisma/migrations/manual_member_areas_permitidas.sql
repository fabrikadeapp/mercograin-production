-- ============================================
-- WorkspaceMember — áreas permitidas + cargo
--
-- Reorganização do produto em 4 áreas (Mesa/Financeiro/Fiscal/Gestão).
-- CEO/admin marca para cada funcionário a quais áreas tem acesso.
--
-- Apply: psql $DATABASE_URL -f prisma/migrations/manual_member_areas_permitidas.sql
-- Idempotente.
-- ============================================

BEGIN;

ALTER TABLE "WorkspaceMember"
  ADD COLUMN IF NOT EXISTS "areasPermitidas" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "cargo" TEXT;

-- Backfill: membros existentes que NÃO são owner/admin recebem só 'mesa'.
-- owner/admin não precisam (helper canAccessArea ignora areasPermitidas pra eles).
UPDATE "WorkspaceMember"
SET "areasPermitidas" = ARRAY['mesa']
WHERE
  "areasPermitidas" = ARRAY[]::TEXT[]
  AND "role" NOT IN ('owner', 'admin');

COMMIT;

-- Rollback:
-- BEGIN;
--   ALTER TABLE "WorkspaceMember"
--     DROP COLUMN IF EXISTS "areasPermitidas",
--     DROP COLUMN IF EXISTS "cargo";
-- COMMIT;
