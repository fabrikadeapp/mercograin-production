/**
 * S4 M1 — Consulta PEP (Pessoa Exposta Politicamente).
 *
 * Não há base oficial gratuita de PEP no Brasil. O BCB mantém uma circular
 * (CIR 3461) que define PEP, mas a base é mantida por bancos/seguradoras.
 *
 * Para MVP (ZERO custo): adapter mock que sempre retorna `pep: false`,
 * deixando interface pronta para plugar provider pago (ex.: ClearSale, Idwall,
 * Big Data Corp, RecargaPay PEP).
 */

export interface PepResultado {
  documento: string // CPF ou CNPJ limpo
  consultadoEm: string
  pep: boolean
  cargo?: string
  orgao?: string
  vigenciaInicio?: string
  vigenciaFim?: string
  fonte: 'idwall' | 'clearsale' | 'bigdata' | 'mock'
}

export async function consultarPEP(documento: string): Promise<PepResultado> {
  const clean = (documento || '').replace(/\D/g, '')
  return {
    documento: clean,
    consultadoEm: new Date().toISOString(),
    pep: false,
    fonte: 'mock',
  }
}
