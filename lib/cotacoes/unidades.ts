/**
 * Conversões padrão entre unidades de cotação agrícola.
 *
 * Fonte das densidades: USDA standard bushel weights
 *   Soja  : 60 lb/bu = 27,2155 kg/bu
 *   Milho : 56 lb/bu = 25,4012 kg/bu
 *   Trigo : 60 lb/bu = 27,2155 kg/bu
 *   Sorgo : 56 lb/bu = 25,4012 kg/bu
 *   Aveia : 32 lb/bu = 14,5150 kg/bu
 *   Arroz : 45 lb/bu = 20,4117 kg/bu
 *
 * Saca brasileira padrão = 60 kg salvo indicação contrária.
 */

export type Grao = 'soja' | 'milho' | 'trigo' | 'sorgo' | 'aveia' | 'arroz' | 'cafe' | 'algodao'

export type Unidade = 'brlSc60' | 'brlTon' | 'usdBu' | 'brlKg'

export const KG_POR_BU: Record<Grao, number> = {
  soja: 27.2155,
  milho: 25.4012,
  trigo: 27.2155,
  sorgo: 25.4012,
  aveia: 14.515,
  arroz: 20.4117,
  // Sem cotação CBOT clássica em bushel — usamos default 60 lb para fallback
  cafe: 27.2155,
  algodao: 27.2155,
}

/** Saca brasileira padrão por grão. Sempre 60 kg salvo café (60kg verde) e algodão (não usa saca). */
export const KG_POR_SC: Record<Grao, number> = {
  soja: 60,
  milho: 60,
  trigo: 60,
  sorgo: 60,
  aveia: 60,
  arroz: 60,
  cafe: 60,
  algodao: 60,
}

export const UNIDADE_LABEL: Record<Unidade, string> = {
  brlSc60: 'R$/sc',
  brlTon: 'R$/t',
  usdBu: 'US$/bu',
  brlKg: 'R$/kg',
}

export const UNIDADE_LABEL_FULL: Record<Unidade, string> = {
  brlSc60: 'Real por saca de 60 kg',
  brlTon: 'Real por tonelada métrica (1.000 kg)',
  usdBu: 'Dólar por bushel (CBOT nativo)',
  brlKg: 'Real por quilograma',
}

export interface ConversaoCotacao {
  grao: Grao
  /** Quantos kg tem o bushel desse grão (USDA) */
  kgPorBu: number
  /** Quantos kg tem a saca padrão (BR) — geralmente 60. */
  kgPorSc: number
  /** Cotação em R$/sc60 — entrada canônica brasileira. */
  brlSc60: number | null
  /** Cotação em R$/t (tonelada). */
  brlTon: number | null
  /** Cotação em US$/bu (CBOT). */
  usdBu: number | null
  /** Cotação em R$/kg. */
  brlKg: number | null
}

/**
 * Converte UMA cotação para todas as unidades equivalentes.
 *
 * Aceita entrada em qualquer uma das unidades — informe a unidade e o valor.
 * Para conversão R$ ↔ USD precisa do câmbio USD/BRL.
 */
export function expandirCotacao(args: {
  grao: Grao
  unidade: Unidade
  valor: number
  usdbrl?: number | null
}): ConversaoCotacao {
  const { grao, unidade, valor, usdbrl } = args
  const kgPorBu = KG_POR_BU[grao]
  const kgPorSc = KG_POR_SC[grao]
  const buPorSc = kgPorSc / kgPorBu

  let brlKg: number | null = null
  let usdBu: number | null = null

  // Primeiro reduzimos tudo a R$/kg como base (quando possível)
  if (unidade === 'brlSc60') {
    brlKg = valor / kgPorSc
  } else if (unidade === 'brlTon') {
    brlKg = valor / 1000
  } else if (unidade === 'brlKg') {
    brlKg = valor
  } else if (unidade === 'usdBu') {
    usdBu = valor
    if (usdbrl != null && usdbrl > 0) {
      brlKg = (valor * usdbrl) / kgPorBu
    }
  }

  // Calcula USD/bu a partir de R$/kg se ainda não temos
  if (usdBu == null && brlKg != null && usdbrl != null && usdbrl > 0) {
    usdBu = (brlKg * kgPorBu) / usdbrl
  }

  return {
    grao,
    kgPorBu,
    kgPorSc,
    brlSc60: brlKg != null ? brlKg * kgPorSc : null,
    brlTon: brlKg != null ? brlKg * 1000 : null,
    usdBu,
    brlKg,
  }
}

/**
 * Formata UM valor em uma unidade específica, com símbolo + sufixo.
 *
 * Exemplos:
 *   formatCotacao(130.55, 'brlSc60')  → 'R$ 130,55 /sc'
 *   formatCotacao(2175.83, 'brlTon')  → 'R$ 2.175,83 /t'
 *   formatCotacao(12.2575, 'usdBu')   → 'US$ 12,2575 /bu'
 *   formatCotacao(2.18, 'brlKg')      → 'R$ 2,18 /kg'
 */
export function formatCotacao(
  valor: number | null,
  unidade: Unidade,
  opts: { showSuffix?: boolean; digitsOverride?: number } = {}
): { valor: string; sufixo: string; full: string } {
  const showSuffix = opts.showSuffix ?? true
  if (valor == null || !Number.isFinite(valor)) {
    return { valor: '—', sufixo: showSuffix ? UNIDADE_LABEL[unidade].split('/')[1] : '', full: '—' }
  }

  let digits = 2
  let prefix = 'R$'
  if (unidade === 'usdBu') {
    digits = 4
    prefix = 'US$'
  } else if (unidade === 'brlKg') {
    digits = 4
  }
  if (opts.digitsOverride != null) digits = opts.digitsOverride

  const num = valor.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  const sufixo = '/' + UNIDADE_LABEL[unidade].split('/')[1]
  const full = showSuffix ? `${prefix} ${num} ${sufixo}` : `${prefix} ${num}`
  return { valor: `${prefix} ${num}`, sufixo, full }
}

/**
 * Lê preferência do usuário no localStorage (escopo client).
 * Default: 'brlSc60' — saca 60kg é a unidade dominante no comercial BR.
 */
export function lerUnidadePreferida(): Unidade {
  if (typeof window === 'undefined') return 'brlSc60'
  try {
    const v = localStorage.getItem('bhg-unidade')
    if (v === 'brlSc60' || v === 'brlTon' || v === 'usdBu' || v === 'brlKg') return v
  } catch {
    /* ignore */
  }
  return 'brlSc60'
}

export function salvarUnidadePreferida(u: Unidade): void {
  try {
    if (typeof window !== 'undefined') localStorage.setItem('bhg-unidade', u)
  } catch {
    /* ignore */
  }
}
