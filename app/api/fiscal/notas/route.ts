import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const itemSchema = z.object({
  codigo: z.string().optional(),
  descricao: z.string().min(1),
  ncm: z.string().min(2),
  cfop: z.string().min(4).max(4),
  qtd: z.number().positive(),
  unidade: z.string().default('UN'),
  valorUnitario: z.number().nonnegative(),
  valorTotal: z.number().nonnegative(),
  origemUF: z.string().length(2).optional(),
  destinoUF: z.string().length(2).optional(),
  diferimentoICMS: z.boolean().optional(),
  valorICMS: z.number().optional(),
  valorPIS: z.number().optional(),
  valorCOFINS: z.number().optional(),
  aliquotaICMS: z.number().optional(),
})

const notaSchema = z.object({
  tipo: z.enum(['entrada', 'saida', 'devolucao', 'complementar', 'triangular']),
  modelo: z.enum(['55', '65']).default('55'),
  contratoId: z.string().optional().nullable(),
  romaneioId: z.string().optional().nullable(),
  notaPaiId: z.string().optional().nullable(),
  destinatarioDoc: z.string().min(11),
  destinatarioNome: z.string().min(1),
  destinatarioUF: z.string().length(2),
  destinatarioIE: z.string().optional().nullable(),
  itens: z.array(itemSchema).min(1),
  valorFrete: z.number().nonnegative().default(0),
  valorOutros: z.number().nonnegative().default(0),
  valorICMS: z.number().nonnegative().default(0),
  valorPIS: z.number().nonnegative().default(0),
  valorCOFINS: z.number().nonnegative().default(0),
  valorFUNRURAL: z.number().nonnegative().default(0),
  cfopPrincipal: z.string().min(4),
  naturezaOperacao: z.string().min(1),
  finalidadeEmissao: z.enum(['1', '2', '3', '4']).default('1'),
  diferimentoICMS: z.boolean().default(false),
  observacoes: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const status = searchParams.get('status') || ''
  const tipo = searchParams.get('tipo') || ''
  const contratoId = searchParams.get('contratoId') || ''
  const dataIni = searchParams.get('dataIni') || ''
  const dataFim = searchParams.get('dataFim') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'))

  const where: any = scope.whereOwn()
  if (status) where.status = status
  if (tipo) where.tipo = tipo
  if (contratoId) where.contratoId = contratoId
  if (dataIni || dataFim) {
    where.dataEmissao = {}
    if (dataIni) where.dataEmissao.gte = new Date(dataIni)
    if (dataFim) where.dataEmissao.lte = new Date(dataFim)
  }

  const [total, data] = await Promise.all([
    db.notaFiscal.count({ where }),
    db.notaFiscal.findMany({
      where,
      orderBy: { dataEmissao: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: { contrato: { select: { numero: true } } },
    }),
  ])

  return NextResponse.json({ data, total, page, limit })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = notaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data

  const cfg = await db.configuracaoFiscal.findUnique({ where: { workspaceId: scope.workspaceId } })
  if (!cfg) {
    return NextResponse.json({ error: 'Configuração fiscal não cadastrada. Acesse /fiscal/configuracao' }, { status: 412 })
  }

  // Alocar próximo número
  const numero = cfg.proximoNumeroNFe
  const serie = cfg.serieNFe

  const valorProdutos = data.itens.reduce((s, it) => s + it.valorTotal, 0)
  const valorTotal = valorProdutos + data.valorICMS + data.valorFrete + data.valorOutros - data.valorFUNRURAL

  const nota = await db.$transaction(async (tx) => {
    const created = await tx.notaFiscal.create({
      data: {
        workspaceId: scope.workspaceId,
        configFiscalId: cfg.id,
        tipo: data.tipo,
        modelo: data.modelo,
        serie,
        numero,
        status: 'rascunho',
        contratoId: data.contratoId ?? null,
        romaneioId: data.romaneioId ?? null,
        notaPaiId: data.notaPaiId ?? null,
        emitenteCnpj: cfg.cnpjEmissor,
        emitenteNome: '', // será preenchido em /emitir lendo DadosEmpresa
        emitenteUF: data.itens[0]?.origemUF ?? '',
        destinatarioDoc: data.destinatarioDoc.replace(/\D/g, ''),
        destinatarioNome: data.destinatarioNome,
        destinatarioUF: data.destinatarioUF,
        destinatarioIE: data.destinatarioIE ?? null,
        itens: data.itens as any,
        valorProdutos,
        valorICMS: data.valorICMS,
        valorPIS: data.valorPIS,
        valorCOFINS: data.valorCOFINS,
        valorFUNRURAL: data.valorFUNRURAL,
        valorFrete: data.valorFrete,
        valorOutros: data.valorOutros,
        valorTotal,
        cfopPrincipal: data.cfopPrincipal,
        naturezaOperacao: data.naturezaOperacao,
        finalidadeEmissao: data.finalidadeEmissao,
        intermunicipal: false,
        interestadual: data.destinatarioUF !== (data.itens[0]?.origemUF ?? ''),
        diferimentoICMS: data.diferimentoICMS,
        observacoes: data.observacoes ?? null,
      },
    })
    await tx.configuracaoFiscal.update({
      where: { id: cfg.id },
      data: { proximoNumeroNFe: numero + 1 },
    })
    return created
  })

  return NextResponse.json({ data: nota }, { status: 201 })
}
