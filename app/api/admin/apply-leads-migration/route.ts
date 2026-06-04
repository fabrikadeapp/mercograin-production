/**
 * TEMPORÁRIO — cria tabela Lead.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STMTS = [
  `CREATE TABLE IF NOT EXISTS "Lead" (
    "id" TEXT PRIMARY KEY,
    "origemWorkspaceId" TEXT NOT NULL,
    "produtorAccessId" TEXT NOT NULL UNIQUE,
    "nomeCompleto" VARCHAR(255),
    "email" VARCHAR(200) NOT NULL,
    "telefone" VARCHAR(30),
    "whatsapp" VARCHAR(30),
    "cpfCnpj" VARCHAR(20),
    "cargoEmpresa" VARCHAR(120),
    "cidade" VARCHAR(120),
    "uf" VARCHAR(2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'novo',
    "observacao" TEXT,
    "fonte" VARCHAR(40) NOT NULL DEFAULT 'portal_cadastro',
    "ultimoContatoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lead_origemWorkspaceId_fkey"
      FOREIGN KEY ("origemWorkspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
    CONSTRAINT "Lead_produtorAccessId_fkey"
      FOREIGN KEY ("produtorAccessId") REFERENCES "ProdutorAccess"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "Lead"("status")`,
  `CREATE INDEX IF NOT EXISTS "Lead_origemWorkspaceId_idx" ON "Lead"("origemWorkspaceId")`,
  `CREATE INDEX IF NOT EXISTS "Lead_email_idx" ON "Lead"("email")`,
]

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    for (const s of STMTS) await db.$executeRawUnsafe(s)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'erro' },
      { status: 500 },
    )
  }
}
