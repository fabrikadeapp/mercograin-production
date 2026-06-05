import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({}, { status: 401 })
  }
  const ws = await db.workspace.findUnique({
    where: { slug: 'mercograin' },
    include: {
      owner: { select: { id: true, email: true, nome: true, role: true } },
      members: {
        where: { role: { in: ['owner', 'admin'] } },
        include: { user: { select: { email: true, nome: true } } },
      },
    },
  })
  const propostas = await db.proposta.findMany({
    where: { workspaceId: ws?.id },
    select: { id: true, numero: true, status: true, valorTotal: true, cliente: { select: { nome: true } } },
    orderBy: { criadaEm: 'desc' },
    take: 5,
  })
  const contratos = await db.contrato.findMany({
    where: { workspaceId: ws?.id },
    select: { id: true, numero: true, statusAssinatura: true, cliente: { select: { nome: true } } },
    orderBy: { criadoEm: 'desc' },
    take: 5,
  })
  const solicitacoes = await db.solicitacaoCotacao.findMany({
    where: { workspaceId: ws?.id },
    select: { id: true, status: true, grao: true, quantidade: true, cliente: { select: { nome: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
  return NextResponse.json({ ws, propostas, contratos, solicitacoes })
}
