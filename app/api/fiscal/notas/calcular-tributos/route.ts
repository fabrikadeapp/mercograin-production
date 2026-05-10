/**
 * Preview de cálculo de tributos antes da emissão.
 * POST { itens: ItemNF[], regime: Regime }
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { calcularTotaisNF, type ItemNF, type Regime } from '@/lib/fiscal/calculo-tributos'
import { z } from 'zod'

const schema = z.object({
  itens: z.array(z.object({
    descricao: z.string(),
    ncm: z.string(),
    cfop: z.string(),
    qtd: z.number().positive(),
    unidade: z.string().default('UN'),
    valorUnitario: z.number().nonnegative(),
    valorTotal: z.number().nonnegative(),
    origemUF: z.string().length(2),
    destinoUF: z.string().length(2),
    destinatarioTipo: z.enum(['PF', 'PJ']),
    destinatarioRegime: z.enum(['simples', 'normal']).optional(),
    diferimentoICMS: z.boolean().optional(),
    operacao: z.enum(['compra_produtor', 'venda_industria', 'venda_exportacao', 'devolucao', 'transferencia']),
  })).min(1),
  regime: z.enum(['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei']).optional(),
})

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  let regime: Regime = parsed.data.regime ?? 'lucro_presumido'
  if (!parsed.data.regime) {
    const cfg = await db.configuracaoFiscal.findUnique({ where: { workspaceId: scope.workspaceId } })
    if (cfg) regime = cfg.regimeTributario as Regime
  }

  const totais = calcularTotaisNF(parsed.data.itens as ItemNF[], regime)
  return NextResponse.json({ regime, totais })
}
