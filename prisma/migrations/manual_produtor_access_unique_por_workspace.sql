-- Antes: emailLogin era único globalmente.
-- Agora: único por workspace (mesmo email pode estar em várias corretoras).
ALTER TABLE "ProdutorAccess" DROP CONSTRAINT IF EXISTS "ProdutorAccess_emailLogin_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ProdutorAccess_workspaceId_emailLogin_key"
  ON "ProdutorAccess"("workspaceId", "emailLogin");
CREATE INDEX IF NOT EXISTS "ProdutorAccess_emailLogin_idx"
  ON "ProdutorAccess"("emailLogin");
