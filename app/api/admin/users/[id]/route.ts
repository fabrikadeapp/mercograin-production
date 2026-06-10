import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin()
    const u = await db.user.findUnique({
      where: { id: params.id },
      include: {
        workspacesOwned: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          include: { subscription: true },
        },
      },
    })
    if (!u) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const wsIds = u.workspacesOwned.map((w) => w.id)
    const [clientes, propostas, contratos, boletos] = await Promise.all([
      db.cliente.count({ where: { workspaceId: { in: wsIds } } }),
      db.proposta.count({ where: { workspaceId: { in: wsIds } } }),
      db.contrato.count({ where: { workspaceId: { in: wsIds } } }),
      db.boleto.count({ where: { workspaceId: { in: wsIds } } }),
    ])
    return NextResponse.json({
      user: {
        ...u,
        subscription: u.workspacesOwned[0]?.subscription ?? null,
        _count: { clientes, propostas, contratos, boletos },
      },
    })
  } catch (e) {
    return adminErrorResponse(e)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const admin = await requireAdmin()
    if (admin.id === params.id) {
      return NextResponse.json(
        { error: 'cannot_delete_self' },
        { status: 400 },
      )
    }

    const target = await db.user.findUnique({
      where: { id: params.id },
      include: {
        workspacesOwned: { include: { subscription: true } },
      },
    })
    if (!target) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    if (target.role === 'admin') {
      return NextResponse.json(
        { error: 'cannot_delete_admin' },
        { status: 403 },
      )
    }

    const activeStatuses = ['active', 'trialing', 'past_due']
    const hasActiveSubscription = target.workspacesOwned.some(
      (w) => w.subscription && activeStatuses.includes(w.subscription.status),
    )
    if (hasActiveSubscription) {
      return NextResponse.json(
        {
          error: 'has_active_subscription',
          message: 'Cancele a assinatura antes de excluir este usuário.',
        },
        { status: 409 },
      )
    }

    const url = new URL(req.url)
    let confirm = url.searchParams.get('confirm')
    if (!confirm) {
      const body = await req.json().catch(() => ({}))
      confirm = body?.confirm ?? null
    }
    if (!confirm || confirm !== target.email) {
      return NextResponse.json(
        { error: 'confirmation_required' },
        { status: 400 },
      )
    }

    await db.auditLog.create({
      data: {
        userId: admin.id,
        acao: 'admin_excluir_usuario',
        entidade: 'user',
        entidadeId: params.id,
        mudancas: {},
      },
    })
    await db.user.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
