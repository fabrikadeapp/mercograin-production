import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmail } from '@/lib/email/send'
import { contractSignedTemplate } from '@/lib/email/templates/contract-signed'

const updateContratoSchema = z.object({
  numero: z.string().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  statusAssinatura: z.enum(['pendente', 'assinado', 'cancelado']).optional(),
})

// GET - Obter contrato específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: {
        cliente: true,
        proposta: {
          select: {
            numero: true,
            graos: true,
            valorTotal: true,
            tipo: true,
          },
        },
      },
    })

    if (!contrato) {
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(contrato)
  } catch (error) {
    console.error('Get contrato error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar contrato' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar contrato
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })

    if (!contrato) {
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = updateContratoSchema.parse(body)

    const wasUnsigned = contrato.statusAssinatura !== 'assinado'
    const willBeSigned = data.statusAssinatura === 'assinado'
    const updated = await db.contrato.update({
      where: { id: params.id },
      data: {
        numero: data.numero,
        dataInicio: data.dataInicio ? new Date(data.dataInicio) : undefined,
        dataFim: data.dataFim ? new Date(data.dataFim) : undefined,
        statusAssinatura: data.statusAssinatura,
        assinadoEm: wasUnsigned && willBeSigned ? new Date() : undefined,
      },
      include: {
        cliente: true,
        workspace: { select: { owner: { select: { email: true, nome: true } } } },
      },
    })

    // Notifica corretora (workspace owner) quando contrato é assinado.
    if (wasUnsigned && willBeSigned) {
      const ownerEmail = updated.workspace?.owner?.email
      if (ownerEmail) {
        try {
          const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
          const tpl = contractSignedTemplate({
            contractNumber: updated.numero,
            signerName: updated.cliente?.nome || 'Cliente',
            signedAt: updated.assinadoEm ?? new Date(),
            contractUrl: `${APP_URL}/contratos/${updated.id}`,
          })
          await sendEmail({ to: ownerEmail, subject: tpl.subject, html: tpl.html, text: tpl.text })
        } catch (emailError) {
          console.error('Erro ao enviar notificação contrato_assinado:', emailError)
        }
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Update contrato error:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar contrato' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar contrato
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })

    if (!contrato) {
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )
    }

    await db.contrato.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete contrato error:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar contrato' },
      { status: 500 }
    )
  }
}

// PATCH - Atualizar status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: { cliente: true },
    })

    if (!contrato) {
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { statusAssinatura } = z.object({
      statusAssinatura: z.enum(['pendente', 'assinado', 'cancelado']),
    }).parse(body)

    const updated = await db.contrato.update({
      where: { id: params.id },
      data: {
        statusAssinatura,
        assinadoEm: statusAssinatura === 'assinado' && !contrato.assinadoEm ? new Date() : undefined,
      },
      include: {
        cliente: true,
        proposta: {
          select: { numero: true },
        },
      },
    })

    // Notifica corretora (workspace owner) — email é o do dono do workspace, não do cliente.
    if (statusAssinatura === 'assinado' && !contrato.assinadoEm) {
      try {
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
        const ws = await db.workspace.findUnique({
          where: { id: contrato.workspaceId },
          select: { owner: { select: { email: true } } },
        })
        const ownerEmail = ws?.owner?.email
        if (ownerEmail) {
          const tpl = contractSignedTemplate({
            contractNumber: updated.numero,
            signerName: updated.cliente?.nome || 'Cliente',
            signedAt: updated.assinadoEm ?? new Date(),
            contractUrl: `${APP_URL}/contratos/${updated.id}`,
          })
          await sendEmail({ to: ownerEmail, subject: tpl.subject, html: tpl.html, text: tpl.text })
        }
      } catch (emailError) {
        console.error('Erro ao enviar notificação contrato_assinado (PATCH):', emailError)
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Patch contrato error:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar contrato' },
      { status: 500 }
    )
  }
}
