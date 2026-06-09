-- F1-04: Negócio (deal) — une oferta+demanda+2 contrapartes+estágios.
BEGIN;
CREATE TABLE IF NOT EXISTS "Negocio" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "numero" VARCHAR(60) NOT NULL,
  "ofertaVendaId" TEXT, "demandaCompraId" TEXT, "vendedorClienteId" TEXT, "compradorClienteId" TEXT,
  "cultura" TEXT, "qtdSc" DECIMAL(14,2), "precoSc" DECIMAL(10,2), "precoMoeda" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  "propostaId" TEXT, "contratoId" TEXT,
  "estagio" TEXT NOT NULL DEFAULT 'match', "responsavelId" TEXT,
  "estagioMudadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "historico" JSONB, "observacao" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Negocio_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Negocio_ws_numero_key" ON "Negocio"("workspaceId","numero");
CREATE INDEX IF NOT EXISTS "Negocio_ws_estagio_idx" ON "Negocio"("workspaceId","estagio");
DO $$ BEGIN ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMIT;
