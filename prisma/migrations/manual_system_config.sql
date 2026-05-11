-- SystemConfig — key/value JSON para flags globais de super-admin.
-- Usado por: provider de cotações primário + fallbacks.

CREATE TABLE IF NOT EXISTS "SystemConfig" (
  "key"       TEXT PRIMARY KEY,
  "value"     JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT
);

-- Seed default da configuração de cotações.
-- primary = ordem de tentativa; fallbacks aplicam se primary falhar.
INSERT INTO "SystemConfig" ("key", "value", "updatedAt")
VALUES (
  'quotes.providers',
  '{"primary":"twelvedata","fallbacks":["yahoo","cepea"],"cacheMinutes":5}'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
