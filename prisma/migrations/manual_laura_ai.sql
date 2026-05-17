-- Laura.IA — conversações e mensagens (Onda 5)

BEGIN;

CREATE TABLE IF NOT EXISTS "LauraConversation" (
  "id"                TEXT PRIMARY KEY,
  "workspaceId"       TEXT NOT NULL,
  "canal"             VARCHAR(20) NOT NULL,
  "handle"            VARCHAR(40) NOT NULL,
  "clienteId"         TEXT,
  "status"            VARCHAR(20) NOT NULL DEFAULT 'aberta',
  "intentDetectado"   VARCHAR(40),
  "ultimaMensagemEm"  TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LauraConversation_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "LauraConversation_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "LauraConversation_workspaceId_canal_handle_key"
  ON "LauraConversation"("workspaceId", "canal", "handle");
CREATE INDEX IF NOT EXISTS "LauraConversation_status_ultimaMensagemEm_idx"
  ON "LauraConversation"("status", "ultimaMensagemEm" DESC);
CREATE INDEX IF NOT EXISTS "LauraConversation_workspaceId_idx"
  ON "LauraConversation"("workspaceId");

CREATE TABLE IF NOT EXISTS "LauraMessage" (
  "id"             TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "direcao"        VARCHAR(3) NOT NULL,
  "conteudo"       TEXT NOT NULL,
  "tipo"           VARCHAR(20) NOT NULL DEFAULT 'text',
  "transcricao"    TEXT,
  "llmProvider"    VARCHAR(40),
  "llmModel"       VARCHAR(60),
  "tokensIn"       INTEGER,
  "tokensOut"      INTEGER,
  "custoUsd"       DECIMAL(10, 6),
  "propostaId"     TEXT,
  "extracao"       JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LauraMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "LauraConversation"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "LauraMessage_conversationId_createdAt_idx"
  ON "LauraMessage"("conversationId", "createdAt" DESC);

COMMIT;
