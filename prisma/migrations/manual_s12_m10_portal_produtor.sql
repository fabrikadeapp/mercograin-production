-- S12 M10 — Portal Produtor (B2C lite)
-- Idempotente: pode ser rodado múltiplas vezes sem erro

-- ProdutorAccess
CREATE TABLE IF NOT EXISTS "ProdutorAccess" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "emailLogin" TEXT NOT NULL,
  "passwordHash" TEXT,
  "tokenInicial" TEXT,
  "acessoCriadoEm" TIMESTAMP(3),
  "ultimoLogin" TIMESTAMP(3),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  "totpSecret" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProdutorAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProdutorAccess_clienteId_key" ON "ProdutorAccess"("clienteId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProdutorAccess_emailLogin_key" ON "ProdutorAccess"("emailLogin");
CREATE INDEX IF NOT EXISTS "ProdutorAccess_workspaceId_idx" ON "ProdutorAccess"("workspaceId");

DO $$ BEGIN
  ALTER TABLE "ProdutorAccess" ADD CONSTRAINT "ProdutorAccess_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProdutorAccess" ADD CONSTRAINT "ProdutorAccess_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DocumentoProdutor
CREATE TABLE IF NOT EXISTS "DocumentoProdutor" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "titulo" VARCHAR(255) NOT NULL,
  "descricao" TEXT,
  "arquivoUrl" TEXT NOT NULL,
  "arquivoHash" VARCHAR(128),
  "tamanhoBytes" INTEGER NOT NULL,
  "mimeType" VARCHAR(120) NOT NULL,
  "enviadoPor" TEXT NOT NULL,
  "uploaderId" TEXT,
  "visivel" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentoProdutor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DocumentoProdutor_clienteId_tipo_idx" ON "DocumentoProdutor"("clienteId","tipo");
CREATE INDEX IF NOT EXISTS "DocumentoProdutor_workspaceId_idx" ON "DocumentoProdutor"("workspaceId");

DO $$ BEGIN
  ALTER TABLE "DocumentoProdutor" ADD CONSTRAINT "DocumentoProdutor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DocumentoProdutor" ADD CONSTRAINT "DocumentoProdutor_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MensagemProdutor
CREATE TABLE IF NOT EXISTS "MensagemProdutor" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "remetente" TEXT NOT NULL,
  "texto" TEXT NOT NULL,
  "lidaEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MensagemProdutor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MensagemProdutor_clienteId_createdAt_idx" ON "MensagemProdutor"("clienteId","createdAt");

DO $$ BEGIN
  ALTER TABLE "MensagemProdutor" ADD CONSTRAINT "MensagemProdutor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MensagemProdutor" ADD CONSTRAINT "MensagemProdutor_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
