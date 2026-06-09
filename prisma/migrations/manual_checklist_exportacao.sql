-- F4-05: checklist documental de exportação por contrato.
BEGIN;
CREATE TABLE IF NOT EXISTS "ChecklistExportacaoItem" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "contratoId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL, "titulo" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pendente',
  "arquivoUrl" TEXT, "vencimento" TIMESTAMP(3), "enviadoEm" TIMESTAMP(3), "observacao" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChecklistExportacaoItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ChecklistExportacaoItem_ws_contrato_idx" ON "ChecklistExportacaoItem"("workspaceId","contratoId");
CREATE INDEX IF NOT EXISTS "ChecklistExportacaoItem_ws_status_idx" ON "ChecklistExportacaoItem"("workspaceId","status");
DO $$ BEGIN ALTER TABLE "ChecklistExportacaoItem" ADD CONSTRAINT "ChecklistExportacaoItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMIT;
