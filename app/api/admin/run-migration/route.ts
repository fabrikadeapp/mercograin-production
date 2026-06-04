/**
 * POST /api/admin/run-migration
 *
 * Endpoint temporário para aplicar migrations manuais SQL em produção
 * quando não há acesso direto ao banco do lado do dev.
 *
 * Auth: header `Authorization: Bearer ${CRON_SECRET}` (reusa o mesmo secret
 * dos crons; revogação fácil pelo Railway).
 *
 * Body: { file: string } — nome de arquivo dentro de prisma/migrations/
 *
 * IMPORTANTE:
 *   - Só roda arquivos prisma/migrations/manual_*.sql (validação por prefixo)
 *   - Idempotência depende do conteúdo do SQL (todos os manual_*.sql usam IF NOT EXISTS)
 *   - REMOVA ESTE ENDPOINT após terminar de migrar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const file = String((body as { file?: string }).file ?? '')

  // Validação rigorosa
  if (!/^manual_[a-z_]+\.sql$/.test(file)) {
    return NextResponse.json(
      { error: 'Nome de arquivo inválido. Padrão: manual_<nome>.sql' },
      { status: 400 }
    )
  }

  const filePath = path.join(process.cwd(), 'prisma', 'migrations', file)
  let sql: string
  try {
    sql = await readFile(filePath, 'utf-8')
  } catch (err) {
    return NextResponse.json(
      { error: 'Arquivo não encontrado', file },
      { status: 404 }
    )
  }

  if (!sql.trim()) {
    return NextResponse.json({ error: 'Arquivo vazio' }, { status: 400 })
  }

  const inicio = Date.now()
  try {
    // $executeRawUnsafe permite múltiplos statements DDL
    await db.$executeRawUnsafe(sql)
    return NextResponse.json({
      ok: true,
      file,
      duracaoMs: Date.now() - inicio,
      tamanhoBytes: sql.length,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        file,
        error: err instanceof Error ? err.message : 'erro desconhecido',
        duracaoMs: Date.now() - inicio,
      },
      { status: 500 }
    )
  }
}
