-- AI BYOK / Managed — adiciona configuração de provider AI por workspace
-- + flag de acesso AI por plano.
--
-- Mode 'managed' (default): plataforma fornece a chave OpenAI (faturado via licença).
-- Mode 'byok': cliente traz própria chave OpenAI criptografada (Enterprise).

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "aiMode" TEXT NOT NULL DEFAULT 'managed',
  ADD COLUMN IF NOT EXISTS "aiKeyEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "aiKeyIv" TEXT,
  ADD COLUMN IF NOT EXISTS "aiKeyTag" TEXT,
  ADD COLUMN IF NOT EXISTS "aiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini';

ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "aiAccess" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "aiMonthlyMessages" INTEGER NOT NULL DEFAULT 0;

-- Seed: aplicar aiAccess nos planos canônicos por slug
UPDATE "Plan" SET "aiAccess" = 'none' WHERE slug IN ('free', 'starter');
UPDATE "Plan" SET "aiAccess" = 'managed', "aiMonthlyMessages" = 500 WHERE slug = 'pro';
UPDATE "Plan" SET "aiAccess" = 'managed', "aiMonthlyMessages" = 2000 WHERE slug = 'business';
UPDATE "Plan" SET "aiAccess" = 'byok_allowed', "aiMonthlyMessages" = 0 WHERE slug = 'enterprise';
