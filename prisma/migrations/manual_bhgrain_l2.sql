-- ============================================================================
-- BH Grain Lote 2 — Migration aditiva única
-- Gerado via: prisma migrate diff (main vs feat/bhgrain)
-- 100% aditivo: ADD COLUMN, CREATE TABLE, CREATE INDEX, ADD CONSTRAINT.
-- Zero DROP/ALTER destrutivo. Reversível via manual_bhgrain_l2_rollback.sql.
-- Aplicar manualmente em produção (este projeto usa migrations manuais).
-- ============================================================================

-- AlterTable
ALTER TABLE "Proposta" ADD COLUMN     "cotacaoCapturadaEm" TIMESTAMP(3),
ADD COLUMN     "cotacaoFonte" VARCHAR(60),
ADD COLUMN     "cotacaoRefId" TEXT,
ADD COLUMN     "custoEstimado" DECIMAL(15,2),
ADD COLUMN     "lossReason" VARCHAR(60),
ADD COLUMN     "lucroBrutoEstimado" DECIMAL(15,2),
ADD COLUMN     "margemPercent" DECIMAL(6,3),
ADD COLUMN     "marketPriceAtCreation" DECIMAL(15,4),
ADD COLUMN     "nextBestAction" VARCHAR(60),
ADD COLUMN     "nextBestActionReason" TEXT,
ADD COLUMN     "scoreInterno" INTEGER,
ADD COLUMN     "scoreLabel" TEXT,
ADD COLUMN     "validadeCotacao" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "externalRef" VARCHAR(255),
    "clienteId" TEXT,
    "contactName" TEXT,
    "contactHandle" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "aiStatus" TEXT NOT NULL DEFAULT 'aguardando',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "externalRef" VARCHAR(255),
    "direction" VARCHAR(10) NOT NULL,
    "text" TEXT,
    "mediaUrl" TEXT,
    "mediaType" VARCHAR(30),
    "aiExtraction" JSONB,
    "aiScore" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaComercial" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "userId" TEXT,
    "commodity" VARCHAR(40),
    "valorMeta" DECIMAL(15,2) NOT NULL,
    "moeda" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaComercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialAlert" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "severity" VARCHAR(15) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "relatedEntityType" VARCHAR(30),
    "relatedEntityId" TEXT,
    "status" VARCHAR(15) NOT NULL DEFAULT 'aberto',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "commodity" VARCHAR(40),
    "threshold" DECIMAL(15,4),
    "action" VARCHAR(20) NOT NULL,
    "params" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "CommercialRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationHealth" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "integration" VARCHAR(30) NOT NULL,
    "status" VARCHAR(15) NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "responseTimeMs" INTEGER,
    "pendingEvents" INTEGER NOT NULL DEFAULT 0,
    "processedEvents" INTEGER NOT NULL DEFAULT 0,
    "lastErrorMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationHealth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_lastMessageAt_idx" ON "Conversation"("workspaceId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_aiStatus_idx" ON "Conversation"("workspaceId", "aiStatus");

-- CreateIndex
CREATE INDEX "Conversation_clienteId_idx" ON "Conversation"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_workspaceId_channel_externalRef_key" ON "Conversation"("workspaceId", "channel", "externalRef");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_occurredAt_idx" ON "ConversationMessage"("conversationId", "occurredAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_workspaceId_occurredAt_idx" ON "ConversationMessage"("workspaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "MetaComercial_workspaceId_periodo_idx" ON "MetaComercial"("workspaceId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "MetaComercial_workspaceId_periodo_userId_commodity_key" ON "MetaComercial"("workspaceId", "periodo", "userId", "commodity");

-- CreateIndex
CREATE INDEX "CommercialAlert_workspaceId_status_idx" ON "CommercialAlert"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "CommercialAlert_workspaceId_severity_status_idx" ON "CommercialAlert"("workspaceId", "severity", "status");

-- CreateIndex
CREATE INDEX "CommercialAlert_relatedEntityType_relatedEntityId_idx" ON "CommercialAlert"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "CommercialRule_workspaceId_type_active_idx" ON "CommercialRule"("workspaceId", "type", "active");

-- CreateIndex
CREATE INDEX "IntegrationHealth_workspaceId_status_idx" ON "IntegrationHealth"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationHealth_workspaceId_integration_key" ON "IntegrationHealth"("workspaceId", "integration");

-- CreateIndex
CREATE INDEX "Proposta_cotacaoRefId_idx" ON "Proposta"("cotacaoRefId");

-- AddForeignKey
ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_cotacaoRefId_fkey" FOREIGN KEY ("cotacaoRefId") REFERENCES "Cotacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaComercial" ADD CONSTRAINT "MetaComercial_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAlert" ADD CONSTRAINT "CommercialAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialRule" ADD CONSTRAINT "CommercialRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationHealth" ADD CONSTRAINT "IntegrationHealth_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

