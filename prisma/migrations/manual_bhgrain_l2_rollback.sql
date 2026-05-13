-- ============================================================================
-- BH Grain Lote 2 — ROLLBACK
-- Reverte manual_bhgrain_l2.sql. Aplicar somente se precisar desfazer.
-- Não destrutivo para dados pré-existentes (Proposta segue intacta após drop
-- das colunas opcionais — dados nas colunas novas são perdidos, mas elas são
-- 100% opcionais e sem backfill, conforme decisão registrada no Lote 0).
-- ============================================================================

-- Drop FKs (filhas → pais)
ALTER TABLE "ConversationMessage" DROP CONSTRAINT IF EXISTS "ConversationMessage_conversationId_fkey";
ALTER TABLE "ConversationMessage" DROP CONSTRAINT IF EXISTS "ConversationMessage_workspaceId_fkey";
ALTER TABLE "Conversation"        DROP CONSTRAINT IF EXISTS "Conversation_workspaceId_fkey";
ALTER TABLE "MetaComercial"       DROP CONSTRAINT IF EXISTS "MetaComercial_workspaceId_fkey";
ALTER TABLE "CommercialAlert"     DROP CONSTRAINT IF EXISTS "CommercialAlert_workspaceId_fkey";
ALTER TABLE "CommercialRule"      DROP CONSTRAINT IF EXISTS "CommercialRule_workspaceId_fkey";
ALTER TABLE "IntegrationHealth"   DROP CONSTRAINT IF EXISTS "IntegrationHealth_workspaceId_fkey";
ALTER TABLE "Proposta"            DROP CONSTRAINT IF EXISTS "Proposta_cotacaoRefId_fkey";

-- Drop tabelas novas
DROP TABLE IF EXISTS "ConversationMessage";
DROP TABLE IF EXISTS "Conversation";
DROP TABLE IF EXISTS "MetaComercial";
DROP TABLE IF EXISTS "CommercialAlert";
DROP TABLE IF EXISTS "CommercialRule";
DROP TABLE IF EXISTS "IntegrationHealth";

-- Drop colunas aditivas na Proposta
ALTER TABLE "Proposta"
  DROP COLUMN IF EXISTS "scoreInterno",
  DROP COLUMN IF EXISTS "scoreLabel",
  DROP COLUMN IF EXISTS "custoEstimado",
  DROP COLUMN IF EXISTS "margemPercent",
  DROP COLUMN IF EXISTS "lucroBrutoEstimado",
  DROP COLUMN IF EXISTS "cotacaoRefId",
  DROP COLUMN IF EXISTS "cotacaoFonte",
  DROP COLUMN IF EXISTS "cotacaoCapturadaEm",
  DROP COLUMN IF EXISTS "validadeCotacao",
  DROP COLUMN IF EXISTS "marketPriceAtCreation",
  DROP COLUMN IF EXISTS "lossReason",
  DROP COLUMN IF EXISTS "nextBestAction",
  DROP COLUMN IF EXISTS "nextBestActionReason";

-- Drop índice da FK
DROP INDEX IF EXISTS "Proposta_cotacaoRefId_idx";
