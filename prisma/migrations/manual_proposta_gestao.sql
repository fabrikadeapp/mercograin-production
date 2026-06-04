-- B1 — Gestão de propostas: notas livres + agendamentos de próximos contatos

CREATE TABLE IF NOT EXISTS "PropostaNota" (
  "id"           TEXT PRIMARY KEY,
  "propostaId"   TEXT NOT NULL REFERENCES "Proposta"("id") ON DELETE CASCADE,
  "workspaceId"  TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "texto"        TEXT NOT NULL,
  "autorId"      TEXT NOT NULL,
  "autorNome"    VARCHAR(200),
  "categoria"    VARCHAR(30),
  "criadaEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PropostaNota_propostaId_criadaEm_idx"
  ON "PropostaNota"("propostaId", "criadaEm");
CREATE INDEX IF NOT EXISTS "PropostaNota_workspaceId_criadaEm_idx"
  ON "PropostaNota"("workspaceId", "criadaEm");


CREATE TABLE IF NOT EXISTS "PropostaAgenda" (
  "id"                  TEXT PRIMARY KEY,
  "propostaId"          TEXT NOT NULL REFERENCES "Proposta"("id") ON DELETE CASCADE,
  "workspaceId"         TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "titulo"              VARCHAR(200) NOT NULL,
  "descricao"           TEXT,
  "agendadoPara"        TIMESTAMP(3) NOT NULL,
  "responsavelId"       TEXT NOT NULL,
  "responsavelNome"     VARCHAR(200),
  "status"              VARCHAR(20) NOT NULL DEFAULT 'pendente',
  "concluidoEm"         TIMESTAMP(3),
  "concluidoComentario" TEXT,
  "notificadoEm"        TIMESTAMP(3),
  "criadaEm"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadaEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PropostaAgenda_propostaId_agendadoPara_idx"
  ON "PropostaAgenda"("propostaId", "agendadoPara");
CREATE INDEX IF NOT EXISTS "PropostaAgenda_workspaceId_agendadoPara_idx"
  ON "PropostaAgenda"("workspaceId", "agendadoPara");
CREATE INDEX IF NOT EXISTS "PropostaAgenda_responsavelId_status_agendadoPara_idx"
  ON "PropostaAgenda"("responsavelId", "status", "agendadoPara");
CREATE INDEX IF NOT EXISTS "PropostaAgenda_status_agendadoPara_idx"
  ON "PropostaAgenda"("status", "agendadoPara");
