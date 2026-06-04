/**
 * TEMPORÁRIO — aplica manual_portal_produtor_cadastro.sql em produção.
 * Authorization: Bearer ${CRON_SECRET}
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STMTS = [
  `ALTER TABLE "ProdutorAccess"
    ADD COLUMN IF NOT EXISTS "nomeCompleto"    VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "cpfCnpj"         VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "rg"              VARCHAR(30),
    ADD COLUMN IF NOT EXISTS "nomePai"         VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "nomeMae"         VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "profissao"       VARCHAR(120),
    ADD COLUMN IF NOT EXISTS "nacionalidade"   VARCHAR(80),
    ADD COLUMN IF NOT EXISTS "cargoEmpresa"    VARCHAR(120),
    ADD COLUMN IF NOT EXISTS "telefone"        VARCHAR(30),
    ADD COLUMN IF NOT EXISTS "whatsapp"        VARCHAR(30),
    ADD COLUMN IF NOT EXISTS "enderecoCep"         VARCHAR(12),
    ADD COLUMN IF NOT EXISTS "enderecoLogradouro"  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "enderecoNumero"      VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "enderecoComplemento" VARCHAR(120),
    ADD COLUMN IF NOT EXISTS "enderecoBairro"      VARCHAR(120),
    ADD COLUMN IF NOT EXISTS "enderecoCidade"      VARCHAR(120),
    ADD COLUMN IF NOT EXISTS "enderecoUf"          VARCHAR(2),
    ADD COLUMN IF NOT EXISTS "consentimentos"   JSONB,
    ADD COLUMN IF NOT EXISTS "perfilCompletoEm" TIMESTAMP(3)`,
  `CREATE TABLE IF NOT EXISTS "ProdutorPasswordReset" (
    "id" TEXT PRIMARY KEY,
    "produtorAccessId" TEXT NOT NULL,
    "tokenHash" VARCHAR(120) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedIp" VARCHAR(45),
    "requestedUa" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProdutorPasswordReset_produtorAccessId_fkey"
      FOREIGN KEY ("produtorAccessId") REFERENCES "ProdutorAccess"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "ProdutorPasswordReset_produtorAccessId_idx" ON "ProdutorPasswordReset"("produtorAccessId")`,
  `CREATE INDEX IF NOT EXISTS "ProdutorPasswordReset_expiresAt_idx" ON "ProdutorPasswordReset"("expiresAt")`,
  `CREATE TABLE IF NOT EXISTS "DadosBancariosCliente" (
    "id" TEXT PRIMARY KEY,
    "produtorAccessId" TEXT NOT NULL,
    "banco" VARCHAR(80) NOT NULL,
    "agencia" VARCHAR(20) NOT NULL,
    "conta" VARCHAR(30) NOT NULL,
    "tipoConta" VARCHAR(20) NOT NULL,
    "titularNome" VARCHAR(255) NOT NULL,
    "pixChave" VARCHAR(120),
    "pixTipo" VARCHAR(20),
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DadosBancariosCliente_produtorAccessId_fkey"
      FOREIGN KEY ("produtorAccessId") REFERENCES "ProdutorAccess"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "DadosBancariosCliente_produtorAccessId_idx" ON "DadosBancariosCliente"("produtorAccessId")`,
]

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const aplicados: string[] = []
  try {
    for (const sql of STMTS) {
      await db.$executeRawUnsafe(sql)
      aplicados.push(sql.slice(0, 40).replace(/\s+/g, ' '))
    }
    return NextResponse.json({ ok: true, aplicados: aplicados.length })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, aplicados, error: e?.message ?? 'erro' },
      { status: 500 },
    )
  }
}
