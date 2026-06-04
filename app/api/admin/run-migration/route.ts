/**
 * POST /api/admin/run-migration
 * Endpoint temporário para aplicar migrations manuais SQL em producao.
 * Auth: Bearer ${CRON_SECRET}
 * Body: { file: string }
 *
 * REMOVER APOS USO.
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
  if (!secret) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const file = String((body as { file?: string }).file ?? '')

  if (!/^manual_[a-z_]+\.sql$/.test(file)) {
    return NextResponse.json({ error: 'Nome de arquivo invalido' }, { status: 400 })
  }

  const filePath = path.join(process.cwd(), 'prisma', 'migrations', file)
  let sql: string
  try {
    sql = await readFile(filePath, 'utf-8')
  } catch {
    return NextResponse.json({ error: 'Arquivo nao encontrado', file }, { status: 404 })
  }

  const inicio = Date.now()
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
        error: err instanceof Error ? err.message : 'erro',
      })
    }
  }

  const todasOk = resultados.every((r) => r.ok)
  return NextResponse.json(
    {
      ok: todasOk,
      file,
      duracaoMs: Date.now() - inicio,
      totalStatements: statements.length,
      sucessos: resultados.filter((r) => r.ok).length,
      falhas: resultados.filter((r) => !r.ok),
    },
    { status: todasOk ? 200 : 207 }
  )
}

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
