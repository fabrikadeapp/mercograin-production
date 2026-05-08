import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user') ?? undefined
    const acao = searchParams.get('action') ?? undefined
    const entidade = searchParams.get('resource') ?? undefined
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10) || 100),
    )

    const where: Prisma.AuditLogWhereInput = {}
    if (userId) where.userId = userId
    if (acao) where.acao = acao
    if (entidade) where.entidade = entidade
    if (from || to) {
      where.criadoEm = {}
      if (from) where.criadoEm.gte = new Date(from)
      if (to) where.criadoEm.lte = new Date(to)
    }

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: limit,
    })
    return NextResponse.json({ data: logs })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
