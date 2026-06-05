/**
 * TEMPORÁRIO v2 — apenas valida que mesmo email pode ter 2 ProdutorAccess
 * em workspaces diferentes (com a nova unique [workspaceId, emailLogin]).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/portal-produtor/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EMAIL = 'multi.v2.smoke@bhgrain.test'
const SENHA = 'Senha12345'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const log: Array<{ p: string; ok: boolean; d?: unknown }> = []
  try {
    // limpa antes
    const old = await db.produtorAccess.findMany({
      where: { emailLogin: EMAIL },
      select: { id: true, clienteId: true },
    })
    for (const o of old) {
      await db.lead.deleteMany({ where: { produtorAccessId: o.id } }).catch(() => undefined)
      await db.produtorPasswordReset.deleteMany({ where: { produtorAccessId: o.id } }).catch(() => undefined)
      await db.cliente.delete({ where: { id: o.clienteId } }).catch(() => undefined)
    }
    log.push({ p: 'clean', ok: true, d: { had: old.length } })

    const wsList = await db.workspace.findMany({ take: 2, select: { id: true, slug: true } })
    if (wsList.length < 2) {
      return NextResponse.json({ log, erro: 'precisa de 2 workspaces' }, { status: 400 })
    }
    const [w1, w2] = wsList

    const c1 = await db.cliente.create({
      data: { workspaceId: w1.id, nome: 'Multi v2 #1', email: EMAIL },
    })
    const a1 = await db.produtorAccess.create({
      data: {
        workspaceId: w1.id,
        clienteId: c1.id,
        emailLogin: EMAIL,
        passwordHash: await hashPassword(SENHA),
      },
    })
    log.push({ p: 'insert-1', ok: true, d: { ws: w1.slug, access: a1.id } })

    const c2 = await db.cliente.create({
      data: { workspaceId: w2.id, nome: 'Multi v2 #2', email: EMAIL },
    })
    const a2 = await db.produtorAccess.create({
      data: {
        workspaceId: w2.id,
        clienteId: c2.id,
        emailLogin: EMAIL,
        passwordHash: await hashPassword(SENHA),
      },
    })
    log.push({ p: 'insert-2', ok: true, d: { ws: w2.slug, access: a2.id } })

    // valida que ambas existem
    const found = await db.produtorAccess.findMany({ where: { emailLogin: EMAIL } })
    log.push({ p: 'find-both', ok: found.length === 2, d: { qty: found.length } })

    // tenta inserir 3o no mesmo workspace -> deve falhar
    let conflito = false
    try {
      await db.produtorAccess.create({
        data: {
          workspaceId: w1.id,
          clienteId: c1.id, // reusa
          emailLogin: EMAIL,
        },
      })
    } catch {
      conflito = true
    }
    log.push({ p: 'dup-mesmo-ws-bloqueia', ok: conflito })

    // Login-multi via endpoint
    const base = process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
    const r = await fetch(`${base}/api/portal/auth/login-multi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, senha: SENHA }),
    })
    const j = (await r.json()) as { modo?: string; acessos?: unknown[] }
    log.push({
      p: 'login-multi',
      ok: r.status === 200 && j.modo === 'multi' && j.acessos?.length === 2,
      d: { status: r.status, modo: j.modo, qty: j.acessos?.length },
    })

    // login-resolve com a2
    const r2 = await fetch(`${base}/api/portal/auth/login-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, senha: SENHA, accessId: a2.id }),
    })
    const j2 = (await r2.json()) as { ok?: boolean; slug?: string }
    log.push({
      p: 'login-resolve',
      ok: r2.status === 200 && j2.ok === true && j2.slug === w2.slug,
      d: { status: r2.status, slug: j2.slug, esperado: w2.slug },
    })

    // limpeza final
    await db.produtorAccess.deleteMany({ where: { emailLogin: EMAIL } })
    await db.cliente.deleteMany({ where: { id: { in: [c1.id, c2.id] } } }).catch(() => undefined)
    log.push({ p: 'clean-final', ok: true })

    return NextResponse.json({ sucesso: log.every((s) => s.ok), log })
  } catch (e: unknown) {
    return NextResponse.json(
      { log, erro: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
