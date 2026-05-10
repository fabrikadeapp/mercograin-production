/**
 * CNAB types — comuns a 240 e 400.
 */

export interface CnabHeader {
  banco: string
  layout: '240' | '400'
  cedenteNome?: string
  cedenteDocumento?: string
  arquivoSeq?: number
  dataGeracao?: string
}

export interface CnabDetalhe {
  nossoNumero: string
  seuNumero: string
  valorTitulo: number
  valorPago: number
  dataVencimento: string | null // ISO yyyy-mm-dd
  dataPagamento: string | null
  ocorrenciaCodigo: string
  ocorrenciaDescricao: string
  /** Linha original (1-indexed) para troubleshooting */
  linha: number
}

export interface CnabRetorno {
  header: CnabHeader
  detalhes: CnabDetalhe[]
  totalRegistros: number
  totalValorPago: number
  errors: string[]
}

/** Códigos de ocorrência FEBRABAN normalizados (subset relevante). */
export const OCORRENCIAS: Record<string, string> = {
  '02': 'Entrada confirmada',
  '03': 'Entrada rejeitada',
  '06': 'Liquidação normal',
  '09': 'Baixa',
  '10': 'Baixa solicitada',
  '14': 'Vencimento alterado',
  '17': 'Liquidação após baixa',
  '19': 'Confirmação de instrução de protesto',
  '23': 'Encaminhado a cartório',
  '27': 'Baixa rejeitada',
  '28': 'Débito de tarifas',
}

export function descricaoOcorrencia(codigo: string): string {
  return OCORRENCIAS[codigo] || `Ocorrência ${codigo}`
}

/** Bancos suportados (FEBRABAN). */
export const BANCOS_SUPORTADOS = ['001', '237', '341', '033', '104'] as const
export type BancoSuportado = (typeof BANCOS_SUPORTADOS)[number]

/** Parse data CNAB DDMMAAAA ou DDMMAA -> ISO yyyy-mm-dd. */
export function parseCnabDate(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits === '00000000' || digits === '000000' || digits.length < 6)
    return null
  let dd: string, mm: string, yyyy: string
  if (digits.length === 8) {
    dd = digits.slice(0, 2)
    mm = digits.slice(2, 4)
    yyyy = digits.slice(4, 8)
  } else if (digits.length === 6) {
    dd = digits.slice(0, 2)
    mm = digits.slice(2, 4)
    const yy = parseInt(digits.slice(4, 6), 10)
    // janela: <50 → 20yy, >=50 → 19yy
    yyyy = yy < 50 ? `20${digits.slice(4, 6)}` : `19${digits.slice(4, 6)}`
  } else {
    return null
  }
  const d = parseInt(dd, 10),
    m = parseInt(mm, 10),
    y = parseInt(yyyy, 10)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${yyyy}-${mm}-${dd}`
}

/** Parse valor CNAB: últimos 2 dígitos = centavos. */
export function parseCnabValor(raw: string): number {
  if (!raw) return 0
  const digits = raw.replace(/\D/g, '')
  if (!digits) return 0
  const n = parseInt(digits, 10)
  if (Number.isNaN(n)) return 0
  return Math.round(n) / 100
}
