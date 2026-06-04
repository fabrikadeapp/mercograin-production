/**
 * TEMPORÁRIO — smoke do login multi-corretora.
 * Cria 2 ProdutorAccess para o mesmo email em workspaces diferentes.
 * Roda login-multi → espera modo=multi; login-resolve → seta cookie no slug escolhido.
 * Limpa tudo no fim.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/portal-produtor/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EMAIL = 'multi.smoke@bhgrain.test'
const SENHA = 'SmokeTeste123'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const passos: Array<{ passo: string; ok: boolean; detalhe?: unknown; erro?: string }> = []

  try {
    // 0. Limpa lixo anterior
    const existing = await db.produtorAccess.findMany({
      where: { emailLogin: EMAIL },
      include: { cliente: { select: { id: true, workspaceId: true } } },
    })
    for (const a of existing) {
      await db.produtorPasswordReset.deleteMany({ where: { produtorAccessId: a.id } })
      await db.lead.deleteMany({ where: { produtorAccessId: a.id } })
      await db.produtorAccess.delete({ where: { id: a.id } })
      await db.cliente.delete({ where: { id: a.cliente.id } }).catch(() => undefined)
    }
    passos.push({ passo: '0-limpeza', ok: true, detalhe: { tinha: existing.length } })

    // 0.1 Pega ou cria 2 workspaces para o teste (precisa ter pelo menos 2)
    const wsList = await db.workspace.findMany({ select: { id: true, name: true, slug: true } })
    if (wsList.length < 2) {
      return NextResponse.json({
        passos,
        erro: 'precisa de ao menos 2 workspaces em prod para testar multi',
        wsTotal: wsList.length,
      }, { status: 400 })
    }
    const [ws1, ws2] = wsList.slice(0, 2)

    // 1. Cria 2 ProdutorAccess (clientes diferentes, mesmo email)
    const hash = await hashPassword(SENHA)
    const c1 = await db.cliente.create({
      data: {
        workspaceId: ws1.id,
        nome: 'Multi Smoke #1',
        email: EMAIL,
      },
    })
    const a1 = await db.produtorAccess.create({
      data: {
        workspaceId: ws1.id,
        clienteId: c1.id,
        emailLogin: EMAIL,
        passwordHash: hash,
        acessoCriadoEm: new Date(),
      },
    })
    const c2 = await db.cliente.create({
      data: {
        workspaceId: ws2.id,
        nome: 'Multi Smoke #2',
        email: EMAIL,
      },
    })
    const a2 = await db.produtorAccess.create({
      data: {
        workspaceId: ws2.id,
        clienteId: c2.id,
        emailLogin: EMAIL,
        passwordHash: hash,
        acessoCriadoEm: new Date(),
      },
    })
    passos.push({
      passo: '1-create-2-accessos',
      ok: true,
      detalhe: { a1: a1.id, a2: a2.id, ws1: ws1.slug, ws2: ws2.slug },
    })

    // 2. POST /api/portal/auth/login-multi
    const base = process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
    const r1 = await fetch(`${base}/api/portal/auth/login-multi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, senha: SENHA }),
    })
    const j1 = (await r1.json()) as { ok?: boolean; modo?: string; acessos?: unknown[] }
    const okMulti =
      r1.status === 200 &&
      j1.ok === true &&
      j1.modo === 'multi' &&
      Array.isArray(j1.acessos) &&
      j1.acessos.length === 2
    passos.push({
      passo: '2-login-multi',
      ok: okMulti,
      detalhe: { status: r1.status, modo: j1.modo, qtd: j1.acessos?.length },
    })
    if (!okMulti) return NextResponse.json({ passos }, { status: 500 })

    // 3. POST /api/portal/auth/login-resolve com o accessId de ws2
    const r2 = await fetch(`${base}/api/portal/auth/login-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, senha: SENHA, accessId: a2.id }),
    })
    const j2 = (await r2.json()) as { ok?: boolean; slug?: string }
    passos.push({
      passo: '3-login-resolve',
      ok: r2.status === 200 && j2.ok === true && j2.slug === ws2.slug,
      detalhe: { status: r2.status, slug: j2.slug, esperado: ws2.slug },
    })

    // 4. Senha errada
    const r3 = await fetch(`${base}/api/portal/auth/login-multi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, senha: 'errada' }),
    })
    passos.push({
      passo: '4-senha-errada',
      ok: r3.status === 401,
      detalhe: { status: r3.status },
    })

    // 5. Limpeza
    await db.produtorAccess.deleteMany({ where: { emailLogin: EMAIL } })
    await db.cliente.deleteMany({
      where: { email: EMAIL, OR: [{ id: c1.id }, { id: c2.id }] },
    })
    passos.push({ passo: '5-limpeza-final', ok: true })

    return NextResponse.json({ sucesso: passos.every((p) => p.ok), passos })
  } catch (e: unknown) {
    return NextResponse.json(
      { passos, erro: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
