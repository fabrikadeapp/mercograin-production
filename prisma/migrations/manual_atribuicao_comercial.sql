-- Migration manual idempotente — 2026-05
-- Atribuição comercial: gerente de conta, vendedor, autorização e histórico
-- de atendimento. Reentrante: pode ser executada várias vezes sem efeito
-- adicional após a 1ª execução.

BEGIN;

-- 1) WorkspaceMember.funcoes
ALTER TABLE "WorkspaceMember"
  ADD COLUMN IF NOT EXISTS "funcoes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2) Cliente.responsavelId
ALTER TABLE "Cliente"
  ADD COLUMN IF NOT EXISTS "responsavelId" TEXT;

CREATE INDEX IF NOT EXISTS "Cliente_responsavelId_idx"
  ON "Cliente"("responsavelId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Cliente_responsavelId_fkey'
  ) THEN
    ALTER TABLE "Cliente"
      ADD CONSTRAINT "Cliente_responsavelId_fkey"
      FOREIGN KEY ("responsavelId") REFERENCES "WorkspaceMember"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) ClienteAtendimento (histórico de atendimento)
CREATE TABLE IF NOT EXISTS "ClienteAtendimento" (
  "id"         TEXT PRIMARY KEY,
  "clienteId"  TEXT NOT NULL,
  "memberId"   TEXT NOT NULL,
  "inicioEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fimEm"      TIMESTAMP(3),
  "motivo"     TEXT,
  "observacao" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClienteAtendimento_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE,
  CONSTRAINT "ClienteAtendimento_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClienteAtendimento_clienteId_fimEm_idx"
  ON "ClienteAtendimento"("clienteId", "fimEm");
CREATE INDEX IF NOT EXISTS "ClienteAtendimento_memberId_idx"
  ON "ClienteAtendimento"("memberId");

-- 4) Proposta — gerenteConta, vendedor, autorização
ALTER TABLE "Proposta"
  ADD COLUMN IF NOT EXISTS "gerenteContaId"   TEXT,
  ADD COLUMN IF NOT EXISTS "vendedorId"       TEXT,
  ADD COLUMN IF NOT EXISTS "canalAutorizacao" TEXT,
  ADD COLUMN IF NOT EXISTS "autorizadoEm"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autorizadoPorId"  TEXT;

CREATE INDEX IF NOT EXISTS "Proposta_gerenteContaId_idx" ON "Proposta"("gerenteContaId");
CREATE INDEX IF NOT EXISTS "Proposta_vendedorId_idx"     ON "Proposta"("vendedorId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Proposta_gerenteContaId_fkey') THEN
    ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_gerenteContaId_fkey"
      FOREIGN KEY ("gerenteContaId") REFERENCES "WorkspaceMember"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Proposta_vendedorId_fkey') THEN
    ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_vendedorId_fkey"
      FOREIGN KEY ("vendedorId") REFERENCES "WorkspaceMember"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Proposta_autorizadoPorId_fkey') THEN
    ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_autorizadoPorId_fkey"
      FOREIGN KEY ("autorizadoPorId") REFERENCES "WorkspaceMember"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- 5) Contrato — gerenteConta + vendedor (snapshot da venda)
ALTER TABLE "Contrato"
  ADD COLUMN IF NOT EXISTS "gerenteContaId" TEXT,
  ADD COLUMN IF NOT EXISTS "vendedorId"     TEXT;

CREATE INDEX IF NOT EXISTS "Contrato_gerenteContaId_idx" ON "Contrato"("gerenteContaId");
CREATE INDEX IF NOT EXISTS "Contrato_vendedorId_idx"     ON "Contrato"("vendedorId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Contrato_gerenteContaId_fkey') THEN
    ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_gerenteContaId_fkey"
      FOREIGN KEY ("gerenteContaId") REFERENCES "WorkspaceMember"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Contrato_vendedorId_fkey') THEN
    ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_vendedorId_fkey"
      FOREIGN KEY ("vendedorId") REFERENCES "WorkspaceMember"("id") ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
