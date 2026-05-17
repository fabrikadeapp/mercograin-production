-- ============================================
-- RLS (Row Level Security) — OPCIONAL, NÃO APLICAR EM PRODUÇÃO AINDA
-- ============================================
-- Este arquivo prepara políticas RLS para os modelos sensíveis, mas exige:
--   1. Prisma middleware setar SET app.workspace_id = '<id>' a cada conexão
--   2. Validação completa em staging primeiro
--   3. Plano de rollback (DROP POLICY + DISABLE)
--
-- Antes de rodar este SQL em produção:
--   - Habilitar staging
--   - Adicionar lib/db/rls-middleware.ts (template abaixo)
--   - Rodar suite E2E completa
--   - Monitorar erros 24h
--
-- Como aplicar:
--   psql $DIRECT_URL -f prisma/migrations/manual_rls_optional.sql
--
-- Como reverter:
--   psql $DIRECT_URL <<'SQL'
--   ALTER TABLE "Cliente" DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "Proposta" DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "Contrato" DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "Boleto" DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "ComissaoApurada" DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS tenant_isolation ON "Cliente";
--   DROP POLICY IF EXISTS tenant_isolation ON "Proposta";
--   DROP POLICY IF EXISTS tenant_isolation ON "Contrato";
--   DROP POLICY IF EXISTS tenant_isolation ON "Boleto";
--   DROP POLICY IF EXISTS tenant_isolation ON "ComissaoApurada";
--   SQL

BEGIN;

-- Bypass para o usuário do Prisma (Connection setting será app.workspace_id)
-- IMPORTANTE: o role 'postgres' (usado pelo Prisma) precisa de BYPASSRLS
-- ou as policies precisam ser permissivas pra ele. Vamos pelo segundo caminho.

-- Cliente
ALTER TABLE "Cliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cliente" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Cliente";
CREATE POLICY tenant_isolation ON "Cliente"
  USING (
    "workspaceId" = current_setting('app.workspace_id', true)
    OR current_setting('app.workspace_id', true) = ''
    OR current_setting('app.workspace_id', true) IS NULL
  );

-- Proposta
ALTER TABLE "Proposta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Proposta" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Proposta";
CREATE POLICY tenant_isolation ON "Proposta"
  USING (
    "workspaceId" = current_setting('app.workspace_id', true)
    OR current_setting('app.workspace_id', true) = ''
    OR current_setting('app.workspace_id', true) IS NULL
  );

-- Contrato
ALTER TABLE "Contrato" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contrato" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Contrato";
CREATE POLICY tenant_isolation ON "Contrato"
  USING (
    "workspaceId" = current_setting('app.workspace_id', true)
    OR current_setting('app.workspace_id', true) = ''
    OR current_setting('app.workspace_id', true) IS NULL
  );

-- Boleto
ALTER TABLE "Boleto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Boleto" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Boleto";
CREATE POLICY tenant_isolation ON "Boleto"
  USING (
    "workspaceId" = current_setting('app.workspace_id', true)
    OR current_setting('app.workspace_id', true) = ''
    OR current_setting('app.workspace_id', true) IS NULL
  );

-- ComissaoApurada
ALTER TABLE "ComissaoApurada" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComissaoApurada" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ComissaoApurada";
CREATE POLICY tenant_isolation ON "ComissaoApurada"
  USING (
    "workspaceId" = current_setting('app.workspace_id', true)
    OR current_setting('app.workspace_id', true) = ''
    OR current_setting('app.workspace_id', true) IS NULL
  );

COMMIT;

-- ============================================
-- TEMPLATE: lib/db/rls-middleware.ts
-- ============================================
-- import { Prisma } from '@prisma/client'
-- import { auditContext } from './audit-extension'
--
-- export const rlsExtension = Prisma.defineExtension({
--   name: 'rlsExtension',
--   query: {
--     $allOperations({ args, query }) {
--       const ctx = auditContext.getStore()
--       if (!ctx?.workspaceId) return query(args)
--       // Set workspace_id no statement antes de cada query
--       // Limitação: Prisma não expõe set_local; usar $executeRawUnsafe seria caro.
--       // Recomendação: usar transaction com SET LOCAL.
--       return query(args)
--     },
--   },
-- })
