/**
 * POST /api/portal/auth/login-multi
 * Body: { email, senha }
 *
 * Autentica por email + senha sem precisar do slug da corretora.
 * Retorna:
 *  - { ok: true, modo: 'single', slug, accessId }  → cliente cai direto em /portal/<slug>
 *  - { ok: true, modo: 'multi', accessos: [{ accessId, slug, nomeCorretora, logoUrl }] }
 *
 * Não seta cookie ainda quando modo='multi'. Cookie é setado depois pelo
 * /api/portal/auth/login-resolve com o accessId escolhido.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword, setSessionCookie } from '@/lib/portal-produtor/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const email = parsed.data.email.toLowerCase().trim()

  // Pega TODOS os ProdutorAccess desse email (em todas as corretoras).
  const acessos = await db.produtorAccess.findMany({
    where: { emailLogin: email, ativo: true, passwordHash: { not: null } },
    select: {
      id: true,
      passwordHash: true,
      workspaceId: true,
      clienteId: true,
      workspace: {
        select: {
          name: true,
          slug: true,
          empresa: { select: { nomeFantasia: true, razaoSocial: true, logoUrl: true } },
        },
      },
    },
  })

  if (acessos.length === 0) {
    return NextResponse.json({ error: 'credenciais_invalidas' }, { status: 401 })
  }

  // Verifica senha em paralelo (todos os hashes — pode haver senha diferente por corretora)
  const valid = await Promise.all(
    acessos.map(async (a) => ({
      ok: a.passwordHash ? await verifyPassword(parsed.data.senha, a.passwordHash) : false,
      a,
    })),
  )
  const ok = valid.filter((v) => v.ok).map((v) => v.a)

  if (ok.length === 0) {
    return NextResponse.json({ error: 'credenciais_invalidas' }, { status: 401 })
  }

  if (ok.length === 1) {
    const a = ok[0]
    const res = NextResponse.json({
      ok: true,
      modo: 'single',
      slug: a.workspace.slug,
      accessId: a.id,
    })
    await setSessionCookie(res, {
      workspaceId: a.workspaceId,
      clienteId: a.clienteId,
      accessId: a.id,
    })
    await db.produtorAccess
      .update({ where: { id: a.id }, data: { ultimoLogin: new Date() } })
      .catch(() => undefined)
    return res
  }

  // Múltiplas corretoras — devolve a lista para o cliente escolher.
  return NextResponse.json({
    ok: true,
    modo: 'multi',
    acessos: ok.map((a) => ({
      accessId: a.id,
      slug: a.workspace.slug,
      nomeCorretora:
        a.workspace.empresa?.nomeFantasia ||
        a.workspace.empresa?.razaoSocial ||
        a.workspace.name,
      logoUrl: a.workspace.empresa?.logoUrl ?? null,
    })),
  })
}
