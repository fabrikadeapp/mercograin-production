/**
 * DRE — Demonstração do Resultado do Exercício.
 * Computa receitas, deduções, custos, despesas e lucro a partir de
 * MovimentoFinanceiro + Boleto + NotaFiscal.
 *
 * Multi-tenancy estrita via workspaceId. Usa Prisma.Decimal para precisão.
 */
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export interface DREInput {
  workspaceId: string
  safraId?: string
  cultura?: string
  inicio: Date
  fim: Date
}

export interface DREResultado {
  receitaBrutaVendas: number
  receitaComissoes: number
  receitaTotalBruta: number
  deducoesImpostos: number
  deducoesDevolucoes: number
  receitaLiquida: number
  custoMercadoriaVendida: number
  lucroBruto: number
  despesasOperacionais: number
  despesasFinanceiras: number
  despesasComerciais: number
  despesasAdministrativas: number
  resultadoOperacional: number
  resultadoFinanceiro: number
  lucroAntesIR: number
  provisaoIR: number
  lucroLiquido: number
  porSafra: { safraId: string; lucro: number }[]
  porCultura: { cultura: string; lucro: number }[]
}

const D = (n: any): Prisma.Decimal =>
  n instanceof Prisma.Decimal ? n : new Prisma.Decimal(n ?? 0)

const toNum = (d: Prisma.Decimal): number => Number(d.toFixed(2))

const NATUREZA_DESPESA_FINANCEIRA = ['juros', 'iof', 'tarifa_bancaria']
const NATUREZA_DESPESA_COMERCIAL = ['frete', 'corretagem', 'comissao_terceiro']
const NATUREZA_DESPESA_ADMIN = ['salario', 'aluguel', 'energia', 'admin']
const NATUREZA_RECEITA_COMISSAO = ['comissao']
const NATUREZA_IMPOSTO = ['imposto', 'icms', 'pis', 'cofins']

/**
 * Classifica uma natureza em uma das categorias da DRE.
 */
export function classificarNatureza(
  tipo: string,
  natureza: string
): keyof Omit<DREResultado, 'porSafra' | 'porCultura'> | null {
  const n = (natureza || '').toLowerCase()
  if (tipo === 'receita') {
    if (NATUREZA_RECEITA_COMISSAO.includes(n)) return 'receitaComissoes'
    return 'receitaBrutaVendas'
  }
  if (tipo === 'despesa') {
    if (NATUREZA_IMPOSTO.includes(n)) return 'deducoesImpostos'
    if (NATUREZA_DESPESA_FINANCEIRA.includes(n)) return 'despesasFinanceiras'
    if (NATUREZA_DESPESA_COMERCIAL.includes(n)) return 'despesasComerciais'
    if (NATUREZA_DESPESA_ADMIN.includes(n)) return 'despesasAdministrativas'
    if (n === 'cmv' || n === 'compra_grao') return 'custoMercadoriaVendida'
    return 'despesasOperacionais'
  }
  return null
}

export async function calcularDRE(input: DREInput): Promise<DREResultado> {
  const where: any = {
    workspaceId: input.workspaceId,
    data: { gte: input.inicio, lte: input.fim },
  }
  if (input.safraId) where.safraId = input.safraId
  if (input.cultura) where.cultura = input.cultura

  const movs = await db.movimentoFinanceiro.findMany({
    where,
    select: {
      tipo: true,
      natureza: true,
      valor: true,
      safraId: true,
      cultura: true,
    },
  })

  const acc: Record<string, Prisma.Decimal> = {}
  const safraMap = new Map<string, Prisma.Decimal>()
  const culturaMap = new Map<string, Prisma.Decimal>()

  for (const m of movs) {
    const cat = classificarNatureza(m.tipo, m.natureza)
    if (!cat) continue
    acc[cat] = (acc[cat] || new Prisma.Decimal(0)).plus(D(m.valor))

    // Sinal: receita = +, despesa = -
    const sinal = m.tipo === 'receita' ? 1 : -1
    const valorSinal = D(m.valor).times(sinal)
    if (m.safraId) {
      safraMap.set(
        m.safraId,
        (safraMap.get(m.safraId) || new Prisma.Decimal(0)).plus(valorSinal)
      )
    }
    if (m.cultura) {
      culturaMap.set(
        m.cultura,
        (culturaMap.get(m.cultura) || new Prisma.Decimal(0)).plus(valorSinal)
      )
    }
  }

  const receitaBrutaVendas = toNum(acc.receitaBrutaVendas || new Prisma.Decimal(0))
  const receitaComissoes = toNum(acc.receitaComissoes || new Prisma.Decimal(0))
  const receitaTotalBruta = receitaBrutaVendas + receitaComissoes
  const deducoesImpostos = toNum(acc.deducoesImpostos || new Prisma.Decimal(0))
  const deducoesDevolucoes = 0
  const receitaLiquida = receitaTotalBruta - deducoesImpostos - deducoesDevolucoes
  const custoMercadoriaVendida = toNum(
    acc.custoMercadoriaVendida || new Prisma.Decimal(0)
  )
  const lucroBruto = receitaLiquida - custoMercadoriaVendida
  const despesasOperacionais = toNum(
    acc.despesasOperacionais || new Prisma.Decimal(0)
  )
  const despesasFinanceiras = toNum(
    acc.despesasFinanceiras || new Prisma.Decimal(0)
  )
  const despesasComerciais = toNum(acc.despesasComerciais || new Prisma.Decimal(0))
  const despesasAdministrativas = toNum(
    acc.despesasAdministrativas || new Prisma.Decimal(0)
  )

  const resultadoOperacional =
    lucroBruto -
    despesasOperacionais -
    despesasComerciais -
    despesasAdministrativas
  const resultadoFinanceiro = -despesasFinanceiras
  const lucroAntesIR = resultadoOperacional + resultadoFinanceiro
  const provisaoIR = lucroAntesIR > 0 ? round2(lucroAntesIR * 0.15) : 0
  const lucroLiquido = lucroAntesIR - provisaoIR

  return {
    receitaBrutaVendas,
    receitaComissoes,
    receitaTotalBruta,
    deducoesImpostos,
    deducoesDevolucoes,
    receitaLiquida,
    custoMercadoriaVendida,
    lucroBruto,
    despesasOperacionais,
    despesasFinanceiras,
    despesasComerciais,
    despesasAdministrativas,
    resultadoOperacional,
    resultadoFinanceiro,
    lucroAntesIR,
    provisaoIR,
    lucroLiquido,
    porSafra: Array.from(safraMap.entries()).map(([safraId, v]) => ({
      safraId,
      lucro: toNum(v),
    })),
    porCultura: Array.from(culturaMap.entries()).map(([cultura, v]) => ({
      cultura,
      lucro: toNum(v),
    })),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
