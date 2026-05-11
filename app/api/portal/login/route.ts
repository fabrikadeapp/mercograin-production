import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword, setSessionCookie } from '@/lib/portal-produtor/auth'
import { logAudit } from '@/lib/audit/log'

const schema = z.object({
  email: z.string().email(),
  senha: z.string().min(8),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Email/senha inválidos' }, { status: 400 })
    }
    const access = await db.produtorAccess.findUnique({
      where: { emailLogin: parsed.data.email.toLowerCase() },
    })
    if (!access || !access.ativo || !access.passwordHash) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }
    const ok = await verifyPassword(parsed.data.senha, access.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }
    await db.produtorAccess.update({
      where: { id: access.id },
      data: { ultimoLogin: new Date() },
    })
    const res = NextResponse.json({ ok: true, clienteId: access.clienteId })
    await setSessionCookie(res, {
      workspaceId: access.workspaceId,
      clienteId: access.clienteId,
      accessId: access.id,
    })
    await logAudit({
      userId: 'portal-produtor',
      workspaceId: access.workspaceId,
      acao: 'login',
      entidade: 'ProdutorAccess',
      entidadeId: access.id,
    })
    return res
  } catch (e) {
    console.error('[portal/login]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
