-- Manual migration: adiciona campos RH em User e WorkspaceMember.
-- Rodar manualmente: psql $DATABASE_URL -f prisma/migrations/manual_add_rh_fields.sql
-- Ou via Prisma: npx prisma db push (após aplicar este SQL ou deixar prisma sincronizar).

-- ============================
-- User: dados pessoais / RH
-- ============================
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cpf" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telefone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rg" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rgEmissor" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dataNascimento" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pis" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "enderecoCep" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "enderecoRua" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "enderecoNumero" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "enderecoComplemento" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "enderecoBairro" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "enderecoCidade" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "enderecoUF" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dadosBancariosJson" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contatoEmergenciaNome" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contatoEmergenciaTelefone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "perfilCompleto" BOOLEAN NOT NULL DEFAULT false;

-- Unique index em CPF (apenas valores não-nulos colidem)
CREATE UNIQUE INDEX IF NOT EXISTS "User_cpf_key" ON "User"("cpf");

-- ==================================
-- WorkspaceMember: convite com RH
-- ==================================
ALTER TABLE "WorkspaceMember" ADD COLUMN IF NOT EXISTS "cpf" TEXT;
ALTER TABLE "WorkspaceMember" ADD COLUMN IF NOT EXISTS "telefoneWhats" TEXT;
