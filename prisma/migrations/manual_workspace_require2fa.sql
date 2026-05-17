-- 2FA opt-in obrigatório por workspace

BEGIN;

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "require2FA" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
