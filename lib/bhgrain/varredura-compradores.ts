/**
 * Varredura de compradores compatíveis para um pedido de venda (automação
 * WhatsApp→proposta). Dado um pedido de venda de um grão/volume, encontra os
 * clientes COMPRADORES daquele grão e gera uma proposta-RASCUNHO para cada,
 * com preço = cotação CEPEA do dia ± margem (resolvida por cliente/grão/tipo).
 *
 * SEMPRE rascunho — nada é enviado ao cliente automaticamente (revisão humana).
 * Se não houver comprador, não gera nada aqui (o rascunho do remetente já existe).
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
  /** cotação de referência (R$/sc). Se ausente, busca a última no DB. */
  cotacao?: number
}

export interface RascunhoGerado { propostaId: string; numero: string; clienteNome: string; preco: number }

const norm = (s: string) => (s || '').toLowerCase()

function normalizaGrao(c: string): string | null {
  const s = norm(c)
  if (s.includes('soja')) return 'soja'
  if (s.includes('milho')) return 'milho'
  if (s.includes('trigo')) return 'trigo'
  if (s.includes('sorgo')) return 'sorgo'
  return null
}

export async function varrerCompradoresEGerarRascunhos(input: VarreduraInput): Promise<RascunhoGerado[]> {
  const grao = normalizaGrao(input.grao)
  if (!grao || !input.quantidade) return []

  // Cotação de referência.
  let cotacaoPreco = input.cotacao
  let cotacaoId: string | null = null
  let cotacaoFonte: string | null = null
  let cotacaoData: Date | null = null
  if (cotacaoPreco == null) {
    const cot = await db.cotacao.findFirst({ where: { grao }, orderBy: { data: 'desc' } })
    if (!cot) return [] // sem cotação não precifica
    cotacaoPreco = Number((cot as any).close ?? (cot as any).preco)
    cotacaoId = cot.id
    cotacaoFonte = (cot as any).fonte ?? null
    cotacaoData = (cot as any).data ?? null
  }
  if (!Number.isFinite(cotacaoPreco) || (cotacaoPreco as number) <= 0) return []

  // Compradores ativos do grão (tipo comprador|ambos), exceto a origem.
  const compradores = await db.cliente.findMany({
    where: {
      workspaceId: input.workspaceId,
      ativo: true,
      tipo: { in: ['comprador', 'ambos'] },
      ...(input.origemClienteId ? { id: { not: input.origemClienteId } } : {}),
      statusCadastral: 'aprovado',
    },
    select: { id: true, nome: true, margensCliente: { where: { grao, tipo: 'venda' } } },
    take: 50,
  })
  if (compradores.length === 0) return []

  // Margens globais (referência para cascata).
  const globais = await db.commodityMarginRule.findMany({
    where: { workspaceId: input.workspaceId, ativa: true },
    select: { commodity: true, margemPercent: true },
  })
  const globaisMap = globais.map((g) => ({ commodity: g.commodity, margemPercent: Number(g.margemPercent) }))

  const gerados: RascunhoGerado[] = []
  for (const comp of compradores) {
    const margem = resolveMargem({
      grao, tipo: 'venda',
      margensCliente: comp.margensCliente.map((m) => ({ grao: m.grao, tipo: m.tipo, pct: m.pct, ativo: m.ativo })),
      margensGlobais: globaisMap,
    })
    const preco = calcularPreco(cotacaoPreco as number, margem.pct, 'venda')
    const valorTotal = preco * input.quantidade
    const numero = `IA-${Date.now().toString(36).toUpperCase()}-${comp.id.slice(-4)}`

    const prop = await db.proposta.create({
      data: {
        workspaceId: input.workspaceId,
        clienteId: comp.id,
        numero,
        tipo: 'venda',
        graos: { grao, commodity: grao, quantidade: input.quantidade, unidade: input.unidade ?? 'sc', preco },
        valorTotal,
        status: 'rascunho_ia',
        validadeEm: new Date(Date.now() + 24 * 3600 * 1000),
        ...(cotacaoId ? { cotacaoRefId: cotacaoId, cotacaoFonte, cotacaoCapturadaEm: cotacaoData, marketPriceAtCreation: cotacaoPreco as number } : {}),
        descricao: `Gerada por varredura automática (margem ${margem.fonte} ${margem.pct}%).`,
      },
      select: { id: true, numero: true },
    }).catch(() => null)

    if (prop) {
      gerados.push({ propostaId: prop.id, numero: prop.numero, clienteNome: comp.nome, preco })
      await db.auditLog.create({
        data: { userId: 'system:bhgrain-ai', acao: 'Rascunho IA por varredura', entidade: 'Proposta', entidadeId: prop.id, workspaceId: input.workspaceId, mudancas: { numero: prop.numero, comprador: comp.nome, margemFonte: margem.fonte, margemPct: margem.pct, preco } },
      }).catch(() => undefined)
    }
  }

  return gerados
}
