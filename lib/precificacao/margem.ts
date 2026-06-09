/**
 * Resolução de margem e cálculo de preço para a automação WhatsApp→proposta.
 *
 * Cascata de margem: MargemCliente(cliente,grão,tipo) > CommodityMarginRule(grão)
 * > default. O preço da proposta sai de: cotação CEPEA do dia ± margem.
 *   - venda (corretora vende ao comprador): preço = cotação × (1 + margem)
 *   - compra (corretora compra do produtor): preço = cotação × (1 - margem)
 *
 * Puro e testável — as fontes (DB/cotação) são injetadas.
 */

export interface MargemClienteRow { grao: string; tipo: string; pct: number; ativo?: boolean }
export interface MargemGlobalRow { commodity: string; margemPercent: number; ativa?: boolean }

export interface ResolveMargemInput {
  grao: string
  tipo: 'compra' | 'venda'
  margensCliente?: MargemClienteRow[]
  margensGlobais?: MargemGlobalRow[]
  /** Margem default quando nada configurado (%). */
  defaultPct?: number
}

export interface MargemResolvida {
  pct: number
  fonte: 'cliente' | 'global' | 'default'
}

const norm = (s: string) => (s || '').toLowerCase().trim()

export function resolveMargem(input: ResolveMargemInput): MargemResolvida {
  const grao = norm(input.grao)
  const tipo = norm(input.tipo)

  // 1. Margem específica do cliente (grão + tipo).
  const cli = (input.margensCliente ?? []).find(
    (m) => m.ativo !== false && norm(m.grao) === grao && norm(m.tipo) === tipo,
  )
  if (cli) return { pct: cli.pct, fonte: 'cliente' }

  // 2. Margem global por commodity.
  const glob = (input.margensGlobais ?? []).find((m) => m.ativa !== false && norm(m.commodity) === grao)
  if (glob) return { pct: Number(glob.margemPercent), fonte: 'global' }

  // 3. Default.
  return { pct: input.defaultPct ?? 1.5, fonte: 'default' }
}

/**
 * Calcula o preço da proposta a partir da cotação de referência e da margem.
 * @param cotacao preço de mercado (ex.: CEPEA R$/sc)
 * @param margemPct margem em % (do resolveMargem)
 * @param tipo 'venda' acresce margem; 'compra' desconta.
 */
export function calcularPreco(cotacao: number, margemPct: number, tipo: 'compra' | 'venda'): number {
  const c = Number(cotacao) || 0
  const fator = tipo === 'compra' ? 1 - margemPct / 100 : 1 + margemPct / 100
  return Math.round(c * fator * 100) / 100
}
