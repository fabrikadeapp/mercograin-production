-- S2 M10 — 2FA TOTP + Aceite Digital + Web Push
-- ============================================
-- 1) User: 2FA TOTP fields
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "totpSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "totpVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recoveryCodes" TEXT[] NOT NULL DEFAULT '{}';

-- 2) Pending2FA — sessão intermediária entre senha-ok e código TOTP
CREATE TABLE IF NOT EXISTS "Pending2FA" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pending2FA_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Pending2FA_token_key" ON "Pending2FA"("token");
CREATE INDEX IF NOT EXISTS "Pending2FA_userId_idx" ON "Pending2FA"("userId");
CREATE INDEX IF NOT EXISTS "Pending2FA_expiresAt_idx" ON "Pending2FA"("expiresAt");
ALTER TABLE "Pending2FA" ADD CONSTRAINT "Pending2FA_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- 3) AceiteContrato — assinatura digital do produtor
CREATE TABLE IF NOT EXISTS "AceiteContrato" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "contratoId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "aceitanteNome" TEXT,
  "aceitanteCpfCnpj" TEXT,
  "aceitoEm" TIMESTAMP(3),
  "ipAceite" TEXT,
  "userAgentAceite" TEXT,
  "geoLat" DOUBLE PRECISION,
  "geoLng" DOUBLE PRECISION,
  "pdfHashAceito" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pendente',
  "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "observacoesRecusa" TEXT,
  CONSTRAINT "AceiteContrato_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AceiteContrato_tokenHash_key" ON "AceiteContrato"("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "AceiteContrato_contratoId_key" ON "AceiteContrato"("contratoId");
CREATE INDEX IF NOT EXISTS "AceiteContrato_workspaceId_status_idx" ON "AceiteContrato"("workspaceId","status");
CREATE INDEX IF NOT EXISTS "AceiteContrato_tokenHash_idx" ON "AceiteContrato"("tokenHash");
ALTER TABLE "AceiteContrato" ADD CONSTRAINT "AceiteContrato_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;
ALTER TABLE "AceiteContrato" ADD CONSTRAINT "AceiteContrato_contratoId_fkey"
  FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE;

-- 4) PushSubscription — Web Push (VAPID)
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "userId" TEXT,
  "clienteId" TEXT,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "ultimoEnvio" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX IF NOT EXISTS "PushSubscription_clienteId_idx" ON "PushSubscription"("clienteId");
CREATE INDEX IF NOT EXISTS "PushSubscription_workspaceId_idx" ON "PushSubscription"("workspaceId");
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE;
