/**
 * GET /api/assinar/[token]/status-portal
 *
 * Dado um token de assinatura, retorna se o cliente já tem conta no portal,
 * o slug do workspace, e o redirect adequado para o front rotear.
 * Não requer auth — token continua sendo a credencial primária.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validarTokenAssinatura } from '@/lib/contratos/signature/native-token'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const v = validarTokenAssinatura(params.token)
  if (!v.valid) {
    return NextResponse.json(
      { ok: false, erro: v.expirado ? 'expirado' : 'invalido' },
      { status: 403 },
    )
  }
  const a = await db.assinaturaDigital.findUnique({
    where: { providerDocId: v.assinaturaId },
    include: {
      contrato: { select: { id: true, numero: true } },
      workspace: { select: { slug: true, name: true } },
    },
  })
  if (!a) {
    return NextResponse.json({ ok: false, erro: 'nao_encontrada' }, { status: 404 })
  }
  if (a.status === 'cancelado') {
    return NextResponse.json({ ok: false, erro: 'cancelada' }, { status: 410 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sigs: any[] = Array.isArray(a.signatarios) ? (a.signatarios as any[]) : []
  const idx = v.signatorioIdx
  const s = sigs[idx]
  if (!s) {
    return NextResponse.json({ ok: false, erro: 'signatario_invalido' }, { status: 404 })
  }

  // Defesa tokenHash
  if (s.tokenHash && s.tokenHash !== v.tokenHash) {
    return NextResponse.json({ ok: false, erro: 'token_revogado' }, { status: 403 })
  }

  const email = (s.email ?? '').toString().toLowerCase().trim()
  const access = email
    ? await db.produtorAccess.findUnique({
        where: { emailLogin: email },
        select: { id: true, passwordHash: true, perfilCompletoEm: true, tokenInicial: true },
      })
    : null

  const slug = a.workspace.slug
  let proximoPasso: 'signup' | 'setup-senha' | 'login' | 'assinar-logado'
  if (!access) proximoPasso = 'signup'
  else if (access.passwordHash) proximoPasso = 'login'
  else if (access.tokenInicial) proximoPasso = 'setup-senha'
  else proximoPasso = 'signup' // existe access mas sem senha nem token — reabrir signup

  return NextResponse.json({
    ok: true,
    workspaceSlug: slug,
    workspaceNome: a.workspace.name,
    contratoId: a.contrato.id,
    contratoNumero: a.contrato.numero,
    signatario: {
      nome: s.nome ?? s.name ?? null,
      email: s.email ?? null,
      telefone: s.telefone ?? s.phone ?? null,
      jaAssinou: !!s.signedAt,
    },
    contaPortal: {
      existe: !!access,
      temSenha: !!access?.passwordHash,
      perfilCompletoEm: access?.perfilCompletoEm ?? null,
    },
    proximoPasso,
    /** URL para onde redirecionar (front usa quando 'rotear' está ligado). */
    redirect: `/portal/${slug}/contratos/assinar?token=${encodeURIComponent(params.token)}`,
  })
}
