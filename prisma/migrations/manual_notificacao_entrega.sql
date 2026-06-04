-- Épico SN — Saúde das notificações
-- Tabela dedicada para tracking unificado de envios outbound (email + WhatsApp).
-- Suporta delivery confirmation via webhook Evolution e retry manual.

CREATE TABLE IF NOT EXISTS "NotificacaoEntrega" (
  "id"                  TEXT PRIMARY KEY,
  "workspaceId"         TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "canal"               VARCHAR(20) NOT NULL,
  "categoria"           VARCHAR(60) NOT NULL,
  "destinatario"        VARCHAR(200) NOT NULL,
  "destinatarioNome"    VARCHAR(200),
  "status"              VARCHAR(20) NOT NULL DEFAULT 'enviado',
  "providerStatus"      VARCHAR(20),
  "providerStatusEm"    TIMESTAMP(3),
  "providerMessageId"   VARCHAR(255),
  "texto"               TEXT,
  "assunto"             VARCHAR(500),
  "errorMotivo"         TEXT,
  "errorCodigo"         VARCHAR(20),
  "meta"                JSONB,
  "retryCount"          INTEGER NOT NULL DEFAULT 0,
  "retryEm"             TIMESTAMP(3),
  "criadoEm"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "NotificacaoEntrega_workspaceId_criadoEm_idx"
  ON "NotificacaoEntrega"("workspaceId", "criadoEm");
CREATE INDEX IF NOT EXISTS "NotificacaoEntrega_workspaceId_canal_criadoEm_idx"
  ON "NotificacaoEntrega"("workspaceId", "canal", "criadoEm");
CREATE INDEX IF NOT EXISTS "NotificacaoEntrega_workspaceId_status_criadoEm_idx"
  ON "NotificacaoEntrega"("workspaceId", "status", "criadoEm");
CREATE INDEX IF NOT EXISTS "NotificacaoEntrega_providerMessageId_idx"
  ON "NotificacaoEntrega"("providerMessageId");
CREATE INDEX IF NOT EXISTS "NotificacaoEntrega_criadoEm_idx"
  ON "NotificacaoEntrega"("criadoEm");
