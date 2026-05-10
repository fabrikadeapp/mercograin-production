-- S10 M2 — Mesa profissional: Oferta + CenarioCalculadora
-- Idempotente: IF NOT EXISTS em tudo. Aplicar manualmente em produção.

-- =====================================================================
-- Oferta — proposta pública/privada de compra/venda com validade
-- =====================================================================
CREATE TABLE IF NOT EXISTS "Oferta" (
  "id"             TEXT PRIMARY KEY,
  "workspaceId"    TEXT NOT NULL,
  "numero"         VARCHAR(60) NOT NULL UNIQUE,
  "tipo"           VARCHAR(10) NOT NULL,        -- 'compra' | 'venda'
  "cultura"        VARCHAR(30) NOT NULL,        -- 'soja' | 'milho' | 'trigo' | ...
  "qtdSc"          NUMERIC(14,2) NOT NULL,
  "precoSc"        NUMERIC(10,2) NOT NULL,
  "precoMoeda"     VARCHAR(3) NOT NULL DEFAULT 'BRL',  -- 'BRL' | 'USD'
  "origem"         VARCHAR(2),                  -- UF
  "destino"        VARCHAR(2),                  -- UF
  "validadeHoras"  INTEGER NOT NULL DEFAULT 72,
  "validaAte"      TIMESTAMP NOT NULL,
  "status"         VARCHAR(15) NOT NULL DEFAULT 'aberta',  -- 'aberta'|'aceita'|'expirada'|'cancelada'
  "publica"        BOOLEAN NOT NULL DEFAULT false,
  "proprietarioId" TEXT NOT NULL,
  "observacao"     TEXT,
  "propostaId"     TEXT,                        -- preenchido quando aceita
  "createdAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Oferta_workspace_fk"     FOREIGN KEY ("workspaceId")    REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "Oferta_proprietario_fk"  FOREIGN KEY ("proprietarioId") REFERENCES "User"("id")      ON DELETE CASCADE,
  CONSTRAINT "Oferta_proposta_fk"      FOREIGN KEY ("propostaId")     REFERENCES "Proposta"("id")  ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Oferta_workspace_status_cultura_idx" ON "Oferta"("workspaceId","status","cultura");
CREATE INDEX IF NOT EXISTS "Oferta_publica_status_idx"           ON "Oferta"("publica","status");
CREATE INDEX IF NOT EXISTS "Oferta_validaAte_idx"                ON "Oferta"("validaAte");

-- =====================================================================
-- CenarioCalculadora — snapshot serializado da calculadora
-- =====================================================================
CREATE TABLE IF NOT EXISTS "CenarioCalculadora" (
  "id"            TEXT PRIMARY KEY,
  "workspaceId"   TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "nome"          VARCHAR(120) NOT NULL,
  "inputJson"     JSONB NOT NULL,
  "resultadoJson" JSONB NOT NULL,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CenarioCalculadora_workspace_fk" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "CenarioCalculadora_user_fk"      FOREIGN KEY ("userId")      REFERENCES "User"("id")      ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CenarioCalculadora_ws_user_idx" ON "CenarioCalculadora"("workspaceId","userId");
