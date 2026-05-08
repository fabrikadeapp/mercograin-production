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
        subscription: true,
        _count: {
          select: {
            clientes: true,
            propostas: true,
            contratos: true,
            boletos: true,
          },
        },
      },
    })
    if (!u) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ user: u })
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
