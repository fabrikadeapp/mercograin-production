-- Margem por cliente × grão × tipo (automação WhatsApp→proposta).
BEGIN;
CREATE TABLE IF NOT EXISTS "MargemCliente" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "clienteId" TEXT NOT NULL,
  "grao" TEXT NOT NULL, "tipo" TEXT NOT NULL, "pct" DOUBLE PRECISION NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MargemCliente_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MargemCliente_ws_cli_grao_tipo_key" ON "MargemCliente"("workspaceId","clienteId","grao","tipo");
CREATE INDEX IF NOT EXISTS "MargemCliente_ws_cli_idx" ON "MargemCliente"("workspaceId","clienteId");
DO $$ BEGIN ALTER TABLE "MargemCliente" ADD CONSTRAINT "MargemCliente_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "MargemCliente" ADD CONSTRAINT "MargemCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMIT;
