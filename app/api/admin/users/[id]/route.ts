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
  _req: Request,
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
