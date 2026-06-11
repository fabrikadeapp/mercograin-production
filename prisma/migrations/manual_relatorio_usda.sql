-- Relatório USDA — snapshot de relatório gerado, para compartilhar via link.
--
-- RelatorioUsda: persiste um relatório USDA montado (config + dados) por
-- workspace, permitindo compartilhamento via link estável e histórico de
-- gerações. 'config' guarda os parâmetros (grãos, seções, métricas) e 'dados'
-- o snapshot já montado (seções/linhas) no momento da geração.
--
-- Idempotente. Aplicar via:
--   railway run npx prisma db execute --file prisma/migrations/manual_relatorio_usda.sql --schema prisma/schema.prisma

BEGIN;

CREATE TABLE IF NOT EXISTS "RelatorioUsda" (
  "id"            TEXT NOT NULL,
  "workspaceId"   TEXT NOT NULL,
  "titulo"        TEXT NOT NULL,
  "mesReferencia" TEXT NOT NULL,
  "config"        JSONB NOT NULL,
  "dados"         JSONB NOT NULL,
  "geradoPor"     TEXT,
  "geradoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RelatorioUsda_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RelatorioUsda_workspaceId_idx"
  ON "RelatorioUsda" ("workspaceId");

-- FK para Workspace (cascade no delete do workspace). Idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RelatorioUsda_workspaceId_fkey'
  ) THEN
    ALTER TABLE "RelatorioUsda"
      ADD CONSTRAINT "RelatorioUsda_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
