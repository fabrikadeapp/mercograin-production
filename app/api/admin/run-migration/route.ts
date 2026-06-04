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

  // Divide o script em statements individuais.
  // Trata DO $$ ... $$ blocks como unidade indivisível.
  const statements = splitSql(sql)

  const resultados: { idx: number; preview: string; ok: boolean; error?: string }[] = []
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim()
    if (!stmt) continue
    try {
      await db.$executeRawUnsafe(stmt)
      resultados.push({ idx: i, preview: stmt.slice(0, 80), ok: true })
    } catch (err) {
      resultados.push({
        idx: i,
        preview: stmt.slice(0, 80),
        ok: false,
        error: err instanceof Error ? err.message : 'erro desconhecido',
      })
    }
  }

  const todasOk = resultados.every((r) => r.ok)
  return NextResponse.json(
    {
      ok: todasOk,
      file,
      duracaoMs: Date.now() - inicio,
      tamanhoBytes: sql.length,
      totalStatements: statements.length,
      sucessos: resultados.filter((r) => r.ok).length,
      falhas: resultados.filter((r) => !r.ok),
    },
    { status: todasOk ? 200 : 207 }
  )
}

/**
 * Divide um script SQL em statements individuais respeitando:
 *   - blocos DO $$ ... $$ (dollar-quoted body)
 *   - strings entre aspas simples
 *   - comentarios linha e bloco
 * Separator: ponto-e-virgula ';' fora de qualquer contexto especial.
 */
function splitSql(sql: string): string[] {
  const result: string[] = []
  let current = ''
  let i = 0
  let inSingleQuote = false
  let inLineComment = false
  let inBlockComment = false
  let inDollarBlock = false

  while (i < sql.length) {
    const c = sql[i]
    const n = sql[i + 1]

    if (inLineComment) {
      current += c
      if (c === '\n') inLineComment = false
      i++
      continue
    }
    if (inBlockComment) {
      current += c
      if (c === '*' && n === '/') {
        current += n
        i += 2
        inBlockComment = false
        continue
      }
      i++
      continue
    }
    if (inSingleQuote) {
      current += c
      if (c === "'" && n === "'") {
        current += n
        i += 2
        continue
      }
      if (c === "'") inSingleQuote = false
      i++
      continue
    }
    if (inDollarBlock) {
      current += c
      if (c === '$' && n === '$') {
        current += n
        i += 2
        inDollarBlock = false
        continue
      }
      i++
      continue
    }

    // Fora de qualquer contexto
    if (c === '-' && n === '-') {
      inLineComment = true
      current += c
      i++
      continue
    }
    if (c === '/' && n === '*') {
      inBlockComment = true
      current += c
      i++
      continue
    }
    if (c === "'") {
      inSingleQuote = true
      current += c
      i++
      continue
    }
    if (c === '$' && n === '$') {
      inDollarBlock = true
      current += c
      current += n
      i += 2
      continue
    }
    if (c === ';') {
      // Fim de statement
      result.push(current)
      current = ''
      i++
      continue
    }

    current += c
    i++
  }

  if (current.trim()) result.push(current)
  return result
}
