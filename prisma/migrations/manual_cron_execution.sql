-- CronExecution + FeatureFlag por workspace (Onda 1 + 2)

BEGIN;

CREATE TABLE IF NOT EXISTS "CronExecution" (
  "id"         TEXT PRIMARY KEY,
  "cron"       VARCHAR(60) NOT NULL,
  "status"     VARCHAR(20) NOT NULL,
  "startedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "message"    TEXT,
  "meta"       JSONB
);

CREATE INDEX IF NOT EXISTS "CronExecution_cron_startedAt_idx"
  ON "CronExecution"("cron", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "CronExecution_status_idx"
  ON "CronExecution"("status");

-- Retention helper: índice pra purgar registros antigos (>30 dias)
CREATE INDEX IF NOT EXISTS "CronExecution_startedAt_purge_idx"
  ON "CronExecution"("startedAt");

COMMIT;
