import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { getBraspagClient } from '@/lib/braspag-client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar boleto (multi-tenancy via Boleto.workspaceId)
    const boleto = await db.boleto.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: {
        cliente: true,
        contrato: true,
      },
    })

    if (!boleto) {
      return NextResponse.json(
        { error: 'Boleto não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se tem braspagId
    if (!boleto.braspagId) {
      return NextResponse.json(
        { error: 'Boleto ainda não foi registrado no Braspag' },
        { status: 400 }
      )
    }

    // Chamar Braspag para obter status atualizado
    try {
      const braspagClient = getBraspagClient()
      const braspagStatus = await braspagClient.getBoletoStatus(boleto.braspagId)

      // Mapear status Braspag para status local
      const statusMap: Record<number, string> = {
        0: 'aberto',
        1: 'pago',
        2: 'cancelado',
        3: 'rejeitado',
        10: 'aberto',
        12: 'vencido',
      }

      const novoStatus = statusMap[braspagStatus.status] || boleto.status

      // Atualizar boleto com novo status
      const updated = await db.boleto.update({
        where: { id: params.id },
        data: {
          status: novoStatus,
          ...(novoStatus === 'pago' && { confirmadoEm: new Date() }),
        },
        include: {
          cliente: true,
          contrato: true,
        },
      })

      return NextResponse.json(updated)
    } catch (braspagError) {
      console.error('[Refresh Status] Erro ao chamar Braspag:', braspagError)

      return NextResponse.json(
        {
          error: 'Erro ao atualizar status no Braspag',
          details: braspagError instanceof Error ? braspagError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Refresh boleto status error:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar status' },
      { status: 500 }
    )
  }
}
