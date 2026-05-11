import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { generateInitialToken } from '@/lib/portal-produtor/auth'
import { sendEmail } from '@/lib/email/send'
import { logAudit } from '@/lib/audit/log'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const cliente = await db.cliente.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    if (!cliente.email) {
      return NextResponse.json(
        { error: 'Cliente sem email cadastrado' },
        { status: 400 }
      )
    }
    const email = cliente.email.toLowerCase()

    const existing = await db.produtorAccess.findUnique({ where: { clienteId: cliente.id } })
    if (existing && existing.passwordHash) {
      return NextResponse.json(
        { error: 'Cliente já possui acesso ativo ao portal' },
        { status: 409 }
      )
    }

    const { raw, hash } = await generateInitialToken()
    const access = existing
      ? await db.produtorAccess.update({
          where: { id: existing.id },
          data: { tokenInicial: hash, emailLogin: email, ativo: true },
        })
      : await db.produtorAccess.create({
          data: {
            workspaceId: cliente.workspaceId,
            clienteId: cliente.id,
            emailLogin: email,
            tokenInicial: hash,
          },
        })

    const ws = await db.workspace.findUnique({
      where: { id: cliente.workspaceId },
      select: { slug: true, name: true },
    })
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.profitsync.ia.br'
    const link = `${base}/portal/${ws?.slug || cliente.workspaceId}/setup?token=${raw}&email=${encodeURIComponent(email)}`

    await sendEmail({
      to: email,
      subject: `[${ws?.name ?? 'Corretora'}] Acesso ao portal do produtor`,
      html: `<p>Olá ${cliente.nome},</p><p>Sua corretora <strong>${ws?.name ?? ''}</strong> liberou seu acesso ao portal.</p><p><a href="${link}">Clique aqui para criar sua senha</a> (link válido para uso único).</p><p>Se você não solicitou este acesso, ignore este email.</p>`,
      text: `Acesse ${link} para criar sua senha.`,
    })

    await logAudit({
      userId: scope.userId,
      workspaceId: cliente.workspaceId,
      acao: 'create',
      entidade: 'ProdutorAccess.invite',
      entidadeId: access.id,
      mudancas: { email },
    })

    return NextResponse.json({ ok: true, email })
  } catch (e: any) {
    console.error('[convidar-portal]', e)
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}
