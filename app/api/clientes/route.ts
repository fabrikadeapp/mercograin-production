import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isValidCPF, isValidCNPJ } from '@/lib/br/documento'
import { logAudit } from '@/lib/audit/log'
import { tryIniciarAprovacao } from '@/lib/compliance'

const cpfRefinement = z
  .string()
  .optional()
  .refine(
    (v) => !v || v.length === 0 || isValidCPF(v),
    { message: 'CPF inválido' }
  )

const cnpjRefinement = z
  .string()
  .optional()
  .refine(
    (v) => !v || v.length === 0 || isValidCNPJ(v),
    { message: 'CNPJ inválido' }
  )

// QW4 — schema estendido com PF/PJ + dados bancários + governança
const dadosBancariosSchema = z
  .object({
    banco: z.string().optional(),
    agencia: z.string().optional(),
    conta: z.string().optional(),
    tipo: z.string().optional(),
    pixChave: z.string().optional(),
  })
  .partial()
  .optional()

const clienteSchema = z.object({
  nome: z.string().min(3),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  cnpj: cnpjRefinement,
  cpf: cpfRefinement,
  endereco: z.string().optional(),
  tipo: z.enum(['comprador', 'vendedor']),
  // QW4
  tipoPessoa: z.enum(['PF', 'PJ']).optional(),
  dadosBancarios: dadosBancariosSchema,
  inscricaoEstadual: z.string().optional(),
  porte: z.enum(['ME', 'EPP', 'medio', 'grande']).optional(),
  origemCapital: z.enum(['nacional', 'estrangeiro']).optional(),
  scoreRelacionamento: z.number().int().min(0).max(1000).optional(),
  limiteCredito: z.number().nonnegative().optional(),
})

// GET - Listar clientes (com paginação e filtros)
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
    const tipo = searchParams.get('tipo') || ''
    const ativo = searchParams.get('ativo')

    const skip = (page - 1) * limit

    const where: any = scope.whereOwn()
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cnpj: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (tipo) {
      where.tipo = tipo
    }
    if (ativo !== null && ativo !== undefined) {
      where.ativo = ativo === 'true'
    }

    const [total, clientes] = await Promise.all([
      db.cliente.count({ where }),
      db.cliente.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      data: clientes,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Get clientes error:', error)
    return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 })
  }
}

// POST - Criar cliente
export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = clienteSchema.parse(body)

    // QW5 — se há workflow de aprovação cadastral ativo, cliente nasce em análise
    const workflows = await db.aprovacaoWorkflow.findMany({
      where: {
        workspaceId: scope.workspaceId,
        entidade: 'cliente',
        ativo: true,
      },
    })
    const temWorkflow = workflows.length > 0
    const statusCadastral = temWorkflow ? 'analise' : 'aprovado'

    const cliente = await db.cliente.create({
      data: {
        ...data,
        // Decimal aceita number; Prisma converte
        limiteCredito: data.limiteCredito as any,
        statusCadastral,
        workspaceId: scope.workspaceId,
      } as any,
    })

    // QW2 — audit log de criação (best-effort)
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'create',
      entidade: 'cliente',
      entidadeId: cliente.id,
      mudancas: { snapshot: cliente },
    })

    // QW5 — dispara workflow de aprovação se aplicável (best-effort)
    if (temWorkflow) {
      try {
        await tryIniciarAprovacao({
          workspaceId: scope.workspaceId,
          solicitanteId: scope.userId,
          entidade: { tipo: 'cliente', id: cliente.id },
          snapshot: cliente,
        })
      } catch (e) {
        console.error('[aprovacao cliente]', e)
      }
    }

    return NextResponse.json(cliente, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Create cliente error:', error)
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 })
  }
}
