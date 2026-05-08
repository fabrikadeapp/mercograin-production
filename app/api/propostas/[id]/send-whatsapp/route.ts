/**
 * POST /api/propostas/[id]/send-whatsapp
 * Send WhatsApp notification when proposal is sent
 *
 * Body:
 * {
 *   "phoneNumber": "5511999999999" (optional, uses cliente whatsapp if not provided)
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { queueProposalNotification } from '@/lib/whatsapp-queue'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { z } from 'zod'

const sendWhatsAppSchema = z.object({
  phoneNumber: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Get request body
    const body = await request.json().catch(() => ({}))
    const { phoneNumber: providedPhone } = sendWhatsAppSchema.parse(body)

    // Get proposta (multi-tenancy via Proposta.workspaceId)
    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            whatsapp: true,
            workspaceId: true,
          },
        },
      },
    })

    if (!proposta) {
      return NextResponse.json(
        { error: 'Proposta não encontrada' },
        { status: 404 }
      )
    }

    // Get phone number
    const phoneNumber = providedPhone || proposta.cliente.whatsapp

    if (!phoneNumber) {
      return NextResponse.json(
        {
          error: 'Número WhatsApp não fornecido',
          message: 'O cliente não possui número WhatsApp registrado. Envie manualmente ou registre o número.',
        },
        { status: 400 }
      )
    }

    // Queue notification
    // Convert Decimal to number if needed
    const valor = typeof proposta.valorTotal === 'number' 
      ? proposta.valorTotal 
      : Number(proposta.valorTotal)

    const jobId = await queueProposalNotification(
      phoneNumber,
      proposta.numero,
      proposta.cliente.nome,
      proposta.tipo,
      formatCurrency(valor),
      formatDate(proposta.validadeEm),
      scope.userId
    )

    return NextResponse.json({
      success: true,
      jobId,
      message: `Notificação WhatsApp enfileirada para ${phoneNumber}`,
      phone: phoneNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Error sending WhatsApp:', error)
    return NextResponse.json(
      {
        error: 'Erro ao enviar WhatsApp',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
