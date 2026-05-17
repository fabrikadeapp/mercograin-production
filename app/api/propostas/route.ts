import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/log'
import { resolveMesaScope, wherePropostaMesa } from '@/lib/equipe/scope-mesa'

const propostaSchema = z.object({
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  numero: z.string().min(1, 'Número da proposta é obrigatório'),
  tipo: z.enum(['venda', 'compra'], { errorMap: () => ({ message: 'Tipo inválido (venda/compra)' }) }),
  descricao: z.string().optional(),
  valor: z.number().positive('Valor total deve ser maior que zero'),
  graos: z
    .array(
      z.object({
        grao: z.string().min(1, 'Grão obrigatório'),
        quantidade: z.number().positive('Quantidade > 0'),
        preco: z.number().positive('Preço > 0'),
        subtotal: z.number().positive('Subtotal > 0'),
      })
    )
    .min(1, 'Adicione pelo menos um grão'),
  validadeEm: z.string().min(1, 'Data de validade é obrigatória'),
})

// GET - Listar propostas (com paginação e filtros)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Query params para paginação e filtros
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'))
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const clienteId = searchParams.get('clienteId') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    const skip = (page - 1) * limit

    // Construir where clause com filtros (multi-tenancy via Proposta.workspaceId)
    const where: any = scope.whereOwn()
    const mesa = await resolveMesaScope(scope)
    const mesaFilter = wherePropostaMesa(mesa)
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
    if (status) {
      where.status = status
    }
    if (clienteId) {
      where.clienteId = clienteId
    }
    if (dateFrom || dateTo) {
      where.validadeEm = {}
      if (dateFrom) {
        where.validadeEm.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.validadeEm.lte = new Date(dateTo)
      }
    }

    // Buscar total e dados
    const [total, propostas] = await Promise.all([
      db.proposta.count({ where }),
      db.proposta.findMany({
        where,
        include: {
          cliente: {
            select: { id: true, nome: true },
          },
        },
        orderBy: { criadaEm: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      data: propostas,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Get propostas error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar propostas' },
      { status: 500 }
    )
  }
}

// POST - Criar proposta
export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = propostaSchema.parse(body)

    // Verificar se cliente pertence ao usuário
    const cliente = await db.cliente.findFirst({
      where: { id: data.clienteId, ...scope.whereOwn() },
      select: { id: true, responsavelId: true },
    })

    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Auto-atribuição: vendedor = quem criou (membership atual);
    // gerente de conta = responsável atual do cliente (snapshot).
    const member = await db.workspaceMember.findFirst({
      where: { workspaceId: scope.workspaceId, userId: scope.userId },
      select: { id: true },
    })

    const proposta = await db.proposta.create({
      data: {
        numero: data.numero,
        clienteId: data.clienteId,
        workspaceId: scope.workspaceId,
        tipo: data.tipo,
        graos: data.graos,
        valorTotal: String(data.valor),
        status: 'rascunho',
        descricao: data.descricao,
        validadeEm: new Date(data.validadeEm),
        vendedorId: member?.id ?? null,
        gerenteContaId: cliente.responsavelId ?? member?.id ?? null,
        canalAutorizacao: 'web',
      },
      include: { cliente: true },
    })

    // QW2 — audit log
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'create',
      entidade: 'proposta',
      entidadeId: proposta.id,
      mudancas: {
        numero: proposta.numero,
        clienteId: proposta.clienteId,
        tipo: proposta.tipo,
        valorTotal: Number(proposta.valorTotal),
      },
    })

    return NextResponse.json(proposta, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Mensagem com nome do campo + erro (em vez de só "Required")
      const labels: Record<string, string> = {
        clienteId: 'Cliente',
        numero: 'Número da proposta',
        tipo: 'Tipo',
        valor: 'Valor total',
        validadeEm: 'Data de validade',
        graos: 'Grãos',
      }
      const issues = error.errors.map((e) => {
        const root = e.path[0]
        const label = typeof root === 'string' ? labels[root] ?? root : 'Campo'
        return `${label}: ${e.message}`
      })
      return NextResponse.json(
        { error: issues.join(' · '), issues: error.errors },
        { status: 400 }
      )
    }

    console.error('Create proposta error:', error)
    return NextResponse.json(
      { error: 'Erro ao criar proposta' },
      { status: 500 }
    )
  }
}
