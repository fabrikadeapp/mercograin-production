/**
 * TEMPORÁRIO — cria tabela SolicitacaoCotacao.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STMTS = [
  `CREATE TABLE IF NOT EXISTS "SolicitacaoCotacao" (
    "id" TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "produtorAccessId" TEXT,
    "tipo" VARCHAR(10) NOT NULL DEFAULT 'venda',
    "grao" VARCHAR(40) NOT NULL,
    "quantidade" DECIMAL(14,2) NOT NULL,
    "unidade" VARCHAR(8) NOT NULL DEFAULT 't',
    "precoAlvo" DECIMAL(15,2),
    "prazoEntregaDias" INT,
    "localEntrega" VARCHAR(160),
    "observacao" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "propostaId" TEXT UNIQUE,
    "respondidoPorId" TEXT,
    "respondidoEm" TIMESTAMP(3),
    "motivoRecusa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SolicitacaoCotacao_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
    CONSTRAINT "SolicitacaoCotacao_clienteId_fkey"
      FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE,
    CONSTRAINT "SolicitacaoCotacao_propostaId_fkey"
      FOREIGN KEY ("propostaId") REFERENCES "Proposta"("id") ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "SolicitacaoCotacao_workspaceId_status_idx" ON "SolicitacaoCotacao"("workspaceId", "status")`,
  `CREATE INDEX IF NOT EXISTS "SolicitacaoCotacao_clienteId_idx" ON "SolicitacaoCotacao"("clienteId")`,
]

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    for (const s of STMTS) await db.$executeRawUnsafe(s)
    return NextResponse.json({ ok: true, aplicados: STMTS.length })
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'erro' },
      { status: 500 },
    )
  }
}
