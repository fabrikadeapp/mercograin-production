import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { sendEmail } from '@/lib/email/send'
import { contractCreatedTemplate } from '@/lib/email/templates/contract-created'
import { tryIniciarAprovacao } from '@/lib/compliance'
import { logAudit } from '@/lib/audit/log'
import { resolveMesaScope, whereContratoMesa } from '@/lib/equipe/scope-mesa'
import { nextNumber } from '@/lib/numbering/next-number'

const contratoSchema = z.object({
  proposIdFk: z.string().min(1),
  clienteId: z.string().min(1),
  numero: z.string().optional(),
  descricao: z.string().optional(),
  valor: z.number().positive(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'))
    const search = searchParams.get('search') || ''
    const statusAssinatura = searchParams.get('statusAssinatura') || ''
    const clienteId = searchParams.get('clienteId') || ''

    const skip = (page - 1) * limit

    // Multi-tenancy via Contrato.workspaceId + scope da Mesa
    const where: any = scope.whereOwn()
    const mesa = await resolveMesaScope(scope)
    const mesaFilter = whereContratoMesa(mesa)
    const andClauses: any[] = []
    if (mesaFilter && Object.keys(mesaFilter).length > 0) andClauses.push(mesaFilter)
    if (search) {
      andClauses.push({
        OR: [
          { numero: { contains: search, mode: 'insensitive' } },
          { cliente: { nome: { contains: search, mode: 'insensitive' } } },
        ],
      })
    }
    if (andClauses.length > 0) where.AND = andClauses
    if (statusAssinatura) {
      where.statusAssinatura = statusAssinatura
    }
    if (clienteId) {
      where.clienteId = clienteId
    }

    const [total, contratos] = await Promise.all([
      db.contrato.count({ where }),
      db.contrato.findMany({
        where,
        include: {
          cliente: {
            select: { id: true, nome: true },
          },
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      data: contratos,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Get contratos error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar contratos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = contratoSchema.parse(body)

    const cliente = await db.cliente.findFirst({
      where: { id: data.clienteId, ...scope.whereOwn() },
    })

    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Validar que a proposta também pertence ao usuário
    const proposta = await db.proposta.findFirst({
      where: { id: data.proposIdFk, ...scope.whereOwn() },
    })

    if (!proposta) {
      return NextResponse.json(
        { error: 'Proposta não encontrada' },
        { status: 404 }
      )
    }

    // Compliance gate (Epic 5): se há workflow ativo aplicável, contrato nasce 'pendente_aprovacao'
    let aprovacaoIniciada: any = null
    const valorTotal = Number(proposta.valorTotal || data.valor || 0)
    const workflows = await db.aprovacaoWorkflow.findMany({
      where: {
        workspaceId: scope.workspaceId,
        entidade: 'contrato',
        ativo: true,
      },
    })
    const workflowAplicavel = workflows.find((w) => {
      const cond: any = w.condicao || {}
      if (cond.sempre) return true
      if (typeof cond.valorMinimo === 'number')
        return valorTotal >= cond.valorMinimo
      return false
    })
    const statusAprovacaoInicial = workflowAplicavel
      ? 'pendente_aprovacao'
      : 'aprovado'

    const numeroGerado =
      data.numero?.trim() || (await nextNumber(scope.workspaceId, 'contrato'))

    const contrato = await db.contrato.create({
      data: {
        proposIdFk: data.proposIdFk,
        clienteId: data.clienteId,
        numero: numeroGerado,
        workspaceId: scope.workspaceId,
        dataInicio: new Date(),
        statusAssinatura: 'pendente',
        statusAprovacao: statusAprovacaoInicial,
      },
      include: {
        cliente: true,
        proposta: {
          select: { numero: true, graos: true },
        },
        workspace: {
          select: { name: true, empresa: { select: { razaoSocial: true } } },
        },
      },
    })

    // QW2 — audit log
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'create',
      entidade: 'contrato',
      entidadeId: contrato.id,
      mudancas: {
        numero: contrato.numero,
        clienteId: contrato.clienteId,
        valorTotal,
        statusAprovacao: contrato.statusAprovacao,
      },
    })

    // Inicia aprovação se há workflow aplicável (best-effort)
    if (workflowAplicavel) {
      try {
        aprovacaoIniciada = await tryIniciarAprovacao({
          workspaceId: scope.workspaceId,
          solicitanteId: scope.userId,
          entidade: {
            tipo: 'contrato',
            id: contrato.id,
            valorTotal,
          },
          snapshot: {
            numero: contrato.numero,
            clienteId: contrato.clienteId,
            valorTotal,
          },
        })
      } catch (apErr) {
        console.error('Erro iniciando aprovação:', apErr)
      }
    }

    // Notifica cliente final via Resend (best-effort, não falha a request).
    if (cliente.email) {
      try {
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
        // Extrai primeiro grão da proposta para o resumo do email.
        let granoLabel = '—'
        let quantidadeSc: number | string = '—'
        let precoSc: number | string = '—'
        const graos = contrato.proposta.graos as any
        const first = Array.isArray(graos) ? graos[0] : null
        if (first && typeof first === 'object') {
          granoLabel = String(first.grao || first.label || first.nome || '—')
          quantidadeSc = Number(first.volumeSc ?? first.quantidadeSc ?? first.qtd ?? 0) || '—'
          precoSc = Number(first.precoSc ?? first.preco ?? 0) || '—'
        }
        const corretoraName =
          contrato.workspace?.empresa?.razaoSocial ||
          contrato.workspace?.name ||
          'BH Grain'
        const tpl = contractCreatedTemplate({
          contractNumber: contrato.numero,
          contractUrl: `${APP_URL}/contratos/${contrato.id}`,
          corretoraName,
          granoLabel,
          quantidadeSc,
          precoSc,
        })
        await sendEmail({ to: cliente.email, subject: tpl.subject, html: tpl.html, text: tpl.text })
      } catch (emailError) {
        console.error('Erro ao enviar notificação contrato_criado:', emailError)
      }
    }

    revalidateTag('contratos')
    return NextResponse.json(
      { ...contrato, aprovacao: aprovacaoIniciada?.aprovacao || null },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Create contrato error:', error)
    return NextResponse.json(
      { error: 'Erro ao criar contrato' },
      { status: 500 }
    )
  }
}
