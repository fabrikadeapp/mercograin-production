-- AlterTable: add logoUploadedAt timestamp to DadosEmpresa
-- (logoUrl already exists on this table, mantido por compatibilidade)
ALTER TABLE "DadosEmpresa"
  ADD COLUMN IF NOT EXISTS "logoUploadedAt" TIMESTAMP(3);
