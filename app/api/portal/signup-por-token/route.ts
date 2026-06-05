/**
 * POST /api/portal/signup-por-token
 * Body: { token, senha }
 *
 * Cria ProdutorAccess (1a vez) para o signatário do contrato apontado pelo token.
 * Token de assinatura continua sendo a credencial primária — esta rota só
 * inicializa a conta no portal e abre cookie de sessão.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { validarTokenAssinatura } from '@/lib/contratos/signature/native-token'
import { hashPassword, setSessionCookie } from '@/lib/portal-produtor/auth'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  token: z.string().min(20),
  senha: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'precisa maiúscula')
    .regex(/[a-z]/, 'precisa minúscula')
    .regex(/\d/, 'precisa número'),
})

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }
  const v = validarTokenAssinatura(parsed.data.token)
  if (!v.valid) {
    return NextResponse.json(
      { error: v.expirado ? 'expirado' : 'invalido' },
      { status: 403 },
    )
  }

  const a = await db.assinaturaDigital.findUnique({
    where: { providerDocId: v.assinaturaId },
    include: { contrato: { select: { clienteId: true } } },
  })
  if (!a || a.status === 'cancelado') {
    return NextResponse.json({ error: 'assinatura_invalida' }, { status: 410 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sigs: any[] = Array.isArray(a.signatarios) ? (a.signatarios as any[]) : []
  const s = sigs[v.signatorioIdx]
  if (!s) {
    return NextResponse.json({ error: 'signatario_invalido' }, { status: 404 })
  }
  if (s.tokenHash && s.tokenHash !== v.tokenHash) {
    return NextResponse.json({ error: 'token_revogado' }, { status: 403 })
  }
  const email = (s.email ?? '').toString().toLowerCase().trim()
  if (!email) {
    return NextResponse.json({ error: 'signatario_sem_email' }, { status: 400 })
  }

  // Se já existe access para esse email NESTE workspace, rejeita (usar /login ou /reset).
  const existente = await db.produtorAccess.findFirst({
    where: { emailLogin: email, workspaceId: a.workspaceId },
  })
  if (existente && existente.passwordHash) {
    return NextResponse.json({ error: 'conta_ja_existe_login' }, { status: 409 })
  }

  const passwordHash = await hashPassword(parsed.data.senha)
  const access = existente
    ? await db.produtorAccess.update({
        where: { id: existente.id },
        data: {
          passwordHash,
          tokenInicial: null,
          acessoCriadoEm: new Date(),
          ultimoLogin: new Date(),
          ativo: true,
        },
      })
    : await db.produtorAccess.create({
        data: {
          workspaceId: a.workspaceId,
          clienteId: a.contrato.clienteId,
          emailLogin: email,
          passwordHash,
          acessoCriadoEm: new Date(),
          ultimoLogin: new Date(),
        },
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
    acao: 'create',
    entidade: 'ProdutorAccess.signup',
    entidadeId: access.id,
    mudancas: { viaToken: true },
  }).catch(() => undefined)

  return res
}
