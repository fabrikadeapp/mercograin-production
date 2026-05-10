-- =====================================================
-- S4 M1 — Compliance KYC + Propriedades Rurais
-- Migration idempotente
-- =====================================================

-- 1) Cliente: campos KYC unificado
ALTER TABLE "Cliente"
  ADD COLUMN IF NOT EXISTS "kycResultado" JSONB,
  ADD COLUMN IF NOT EXISTS "kycRodadoEm"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "kycStatus"    TEXT NOT NULL DEFAULT 'nao_verificado';

-- 2) Tabela PropriedadeRural
CREATE TABLE IF NOT EXISTS "PropriedadeRural" (
  "id"                          TEXT NOT NULL,
  "workspaceId"                 TEXT NOT NULL,
  "produtorId"                  TEXT NOT NULL,
  "nome"                        TEXT NOT NULL,
  "matricula"                   TEXT,
  "cartorio"                    TEXT,
  "nirf"                        TEXT,
  "incra"                       TEXT,
  "itr"                         TEXT,
  "car"                         TEXT,
  "carValidadoEm"               TIMESTAMP(3),
  "carStatus"                   TEXT,
  "carResposta"                 JSONB,
  "areaTotalHa"                 DOUBLE PRECISION,
  "areaPlantavelHa"             DOUBLE PRECISION,
  "areaReservaLegal"            DOUBLE PRECISION,
  "areaPreservacaoPermanente"   DOUBLE PRECISION,
  "areaConsolidada"             DOUBLE PRECISION,
  "geoJson"                     JSONB,
  "centroideLat"                DOUBLE PRECISION,
  "centroideLng"                DOUBLE PRECISION,
  "municipio"                   TEXT,
  "uf"                          TEXT,
  "embargoIbama"                BOOLEAN NOT NULL DEFAULT false,
  "embargoVerificadoEm"         TIMESTAMP(3),
  "sobreposicaoTI"              BOOLEAN NOT NULL DEFAULT false,
  "sobreposicaoUC"              BOOLEAN NOT NULL DEFAULT false,
  "alertaDesmatamento"          JSONB,
  "ativo"                       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropriedadeRural_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PropriedadeRural"
    ADD CONSTRAINT "PropriedadeRural_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PropriedadeRural"
    ADD CONSTRAINT "PropriedadeRural_produtorId_fkey"
    FOREIGN KEY ("produtorId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PropriedadeRural_workspaceId_matricula_key"
  ON "PropriedadeRural"("workspaceId", "matricula");
CREATE INDEX IF NOT EXISTS "PropriedadeRural_workspaceId_ativo_idx"
  ON "PropriedadeRural"("workspaceId", "ativo");
CREATE INDEX IF NOT EXISTS "PropriedadeRural_produtorId_idx"
  ON "PropriedadeRural"("produtorId");
CREATE INDEX IF NOT EXISTS "PropriedadeRural_car_idx"
  ON "PropriedadeRural"("car");

-- 3) Talhao: FK opcional para PropriedadeRural
ALTER TABLE "Talhao"
  ADD COLUMN IF NOT EXISTS "propriedadeId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Talhao"
    ADD CONSTRAINT "Talhao_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "PropriedadeRural"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Talhao_propriedadeId_idx"
  ON "Talhao"("propriedadeId");

-- 4) ListaSuja — cache local de listas oficiais
CREATE TABLE IF NOT EXISTS "ListaSuja" (
  "id"          TEXT NOT NULL,
  "lista"       TEXT NOT NULL,
  "cnpjOuCpf"   TEXT NOT NULL,
  "nome"        TEXT NOT NULL,
  "uf"          TEXT,
  "municipio"   TEXT,
  "detalhes"    JSONB,
  "vigenteAte"  TIMESTAMP(3),
  "clienteId"   TEXT,
  "workspaceId" TEXT,
  "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListaSuja_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ListaSuja"
    ADD CONSTRAINT "ListaSuja_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ListaSuja_lista_cnpjOuCpf_idx"
  ON "ListaSuja"("lista", "cnpjOuCpf");
CREATE INDEX IF NOT EXISTS "ListaSuja_cnpjOuCpf_idx"
  ON "ListaSuja"("cnpjOuCpf");
CREATE INDEX IF NOT EXISTS "ListaSuja_clienteId_idx"
  ON "ListaSuja"("clienteId");
