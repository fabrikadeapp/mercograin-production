import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Lista aprovações pendentes do user logado (etapa atual aprovável por sua role).
 * Query params: ?status=pendente|aprovada|rejeitada (default pendente)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const status = searchParams.get('status') || 'pendente'
  const where: any = scope.whereOwn({ status })

  const aprovacoes = await db.aprovacao.findMany({
    where,
    include: {
      workflow: {
        select: { nome: true, etapas: true, entidade: true, slaHoras: true },
      },
      solicitante: { select: { id: true, nome: true, email: true } },
      decisoes: {
        include: {
          aprovador: { select: { id: true, nome: true } },
        },
        orderBy: { etapa: 'asc' },
      },
    },
    orderBy: [{ status: 'asc' }, { prazoEtapaAtual: 'asc' }],
  })

  return NextResponse.json({ data: aprovacoes })
}
