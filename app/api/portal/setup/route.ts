import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  hashPassword,
  verifyInitialToken,
  setSessionCookie,
} from '@/lib/portal-produtor/auth'
import { logAudit } from '@/lib/audit/log'

const schema = z.object({
  token: z.string().min(20),
  email: z.string().email(),
  novaSenha: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'precisa maiúscula')
    .regex(/[a-z]/, 'precisa minúscula')
    .regex(/\d/, 'precisa número'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
        { status: 400 }
      )
    }
    const access = await db.produtorAccess.findUnique({
      where: { emailLogin: parsed.data.email.toLowerCase() },
    })
    if (!access || !access.ativo || !access.tokenInicial) {
      return NextResponse.json({ error: 'Token inválido ou já utilizado' }, { status: 400 })
    }
    const ok = await verifyInitialToken(parsed.data.token, access.tokenInicial)
    if (!ok) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }
    const passwordHash = await hashPassword(parsed.data.novaSenha)
    await db.produtorAccess.update({
      where: { id: access.id },
      data: {
        passwordHash,
        tokenInicial: null,
        acessoCriadoEm: new Date(),
        ultimoLogin: new Date(),
      },
    })
    const res = NextResponse.json({ ok: true })
    await setSessionCookie(res, {
      workspaceId: access.workspaceId,
      clienteId: access.clienteId,
      accessId: access.id,
    })
    await logAudit({
      userId: 'portal-produtor',
      workspaceId: access.workspaceId,
      acao: 'create',
      entidade: 'ProdutorAccess.setup',
      entidadeId: access.id,
    })
    return res
  } catch (e) {
    console.error('[portal/setup]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
