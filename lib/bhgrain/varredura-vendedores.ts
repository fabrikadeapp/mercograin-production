/**
 * Varredura de vendedores para um pedido de COMPRA (espelho de
 * varredura-compradores). Dado um pedido de compra de um grão/volume, encontra
 * os clientes VENDEDORES daquele grão e gera uma proposta-RASCUNHO de COMPRA
 * para cada, com preço = cotação CEPEA do dia − margem de compra
 * (resolvida por cliente/grão/tipo).
 *
 * SEMPRE rascunho — revisão humana na fila de ação. Tipo da proposta = 'compra'.
 */
import { db } from '@/lib/db'
import { resolveMargem, calcularPreco } from '@/lib/precificacao/margem'

interface VarreduraInput {
  workspaceId: string
  grao: string
  quantidade: number
  unidade?: string
  /** id do cliente que originou o pedido (excluído da varredura). */
  origemClienteId?: string | null
  cotacao?: number
}

export interface RascunhoGerado { propostaId: string; numero: string; clienteNome: string; preco: number }

function normalizaGrao(c: string): string | null {
  const s = (c || '').toLowerCase()
  if (s.includes('soja')) return 'soja'
  if (s.includes('milho')) return 'milho'
  if (s.includes('trigo')) return 'trigo'
  if (s.includes('sorgo')) return 'sorgo'
  return null
}

export async function varrerVendedoresEGerarRascunhos(input: VarreduraInput): Promise<RascunhoGerado[]> {
  const grao = normalizaGrao(input.grao)
  if (!grao || !input.quantidade) return []

  // Cotação de referência.
  let cotacaoPreco = input.cotacao
  let cotacaoId: string | null = null
  let cotacaoFonte: string | null = null
  let cotacaoData: Date | null = null
  if (cotacaoPreco == null) {
    const cot = await db.cotacao.findFirst({ where: { grao }, orderBy: { data: 'desc' } })
    if (!cot) return []
    cotacaoPreco = Number((cot as any).close ?? (cot as any).preco)
    cotacaoId = cot.id
    cotacaoFonte = (cot as any).fonte ?? null
    cotacaoData = (cot as any).data ?? null
  }
  if (!Number.isFinite(cotacaoPreco) || (cotacaoPreco as number) <= 0) return []

  // Registra a DEMANDA (Oferta tipo=compra) — aparece em /demandas.
  // Idempotência best-effort: não bloqueia o fluxo se falhar.
  try {
    const { gerarNumeroOferta, calcValidaAte } = await import('@/lib/ofertas/service')
    const owner = await db.workspaceMember.findFirst({ where: { workspaceId: input.workspaceId }, select: { userId: true } })
    if (owner?.userId) {
      await db.oferta.create({
        data: {
          workspaceId: input.workspaceId,
          numero: gerarNumeroOferta(),
          tipo: 'compra',
          cultura: grao,
          qtdSc: input.quantidade,
          precoSc: cotacaoPreco as number,
          validadeHoras: 72,
          validaAte: calcValidaAte(72),
          status: 'aberta',
          proprietarioId: owner.userId,
          observacao: 'Demanda capturada automaticamente.',
        },
      })
    }
  } catch { /* não bloqueia a varredura */ }

  // Vendedores ativos do grão (tipo vendedor|ambos), exceto a origem.
  const vendedores = await db.cliente.findMany({
    where: {
      workspaceId: input.workspaceId,
      ativo: true,
      tipo: { in: ['vendedor', 'ambos'] },
      ...(input.origemClienteId ? { id: { not: input.origemClienteId } } : {}),
      statusCadastral: 'aprovado',
    },
    select: { id: true, nome: true, margensCliente: { where: { grao, tipo: 'compra' } } },
    take: 50,
  })
  if (vendedores.length === 0) return []

  const globais = await db.commodityMarginRule.findMany({
    where: { workspaceId: input.workspaceId, ativa: true },
    select: { commodity: true, margemPercent: true },
  })
  const globaisMap = globais.map((g) => ({ commodity: g.commodity, margemPercent: Number(g.margemPercent) }))

  const gerados: RascunhoGerado[] = []
  for (const v of vendedores) {
    const margem = resolveMargem({
      grao, tipo: 'compra',
      margensCliente: v.margensCliente.map((m) => ({ grao: m.grao, tipo: m.tipo, pct: m.pct, ativo: m.ativo })),
      margensGlobais: globaisMap,
    })
    // Compra: a corretora compra do produtor — desconta a margem.
    const preco = calcularPreco(cotacaoPreco as number, margem.pct, 'compra')
    const valorTotal = preco * input.quantidade
    const numero = `IA-${Date.now().toString(36).toUpperCase()}-${v.id.slice(-4)}`

    const prop = await db.proposta.create({
      data: {
        workspaceId: input.workspaceId,
        clienteId: v.id,
        numero,
        tipo: 'compra',
        graos: { grao, commodity: grao, quantidade: input.quantidade, unidade: input.unidade ?? 'sc', preco },
        valorTotal,
        status: 'rascunho_ia',
        validadeEm: new Date(Date.now() + 24 * 3600 * 1000),
        ...(cotacaoId ? { cotacaoRefId: cotacaoId, cotacaoFonte, cotacaoCapturadaEm: cotacaoData, marketPriceAtCreation: cotacaoPreco as number } : {}),
        descricao: `Gerada por varredura automática de COMPRA (margem ${margem.fonte} ${margem.pct}%).`,
      },
      select: { id: true, numero: true },
    }).catch(() => null)

    if (prop) {
      gerados.push({ propostaId: prop.id, numero: prop.numero, clienteNome: v.nome, preco })
      await db.auditLog.create({
        data: { userId: 'system:bhgrain-ai', acao: 'Rascunho IA por varredura (compra)', entidade: 'Proposta', entidadeId: prop.id, workspaceId: input.workspaceId, mudancas: { numero: prop.numero, vendedor: v.nome, margemFonte: margem.fonte, margemPct: margem.pct, preco } },
      }).catch(() => undefined)
    }
  }

  return gerados
}
