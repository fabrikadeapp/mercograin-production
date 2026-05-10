/**
 * Gerador GNRE — Guia Nacional de Recolhimento de Tributos Estaduais.
 * Usada principalmente para ICMS-ST e ICMS interestadual.
 *
 * Códigos de receita comuns:
 *   100099 ICMS — Outros recolhimentos
 *   100102 ICMS — Substituição tributária por operação
 *   100129 ICMS — Substituição tributária por apuração
 *   100137 ICMS — DIFAL não contribuinte (EC 87/2015)
 *
 * Segmento 7 (demais órgãos / governos estaduais) no padrão FEBRABAN.
 */

import { montarCodigoBarrasArrecadacao } from './util'

const UFs = new Set([
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB',
  'PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
])

/** Código IBGE da UF (2 dígitos) — usado no campo livre. */
const UF_IBGE: Record<string, string> = {
  AC: '12', AL: '27', AM: '13', AP: '16', BA: '29', CE: '23', DF: '53',
  ES: '32', GO: '52', MA: '21', MG: '31', MS: '50', MT: '51', PA: '15',
  PB: '25', PE: '26', PI: '22', PR: '41', RJ: '33', RN: '24', RO: '11',
  RR: '14', RS: '43', SC: '42', SE: '28', SP: '35', TO: '17',
}

export interface GNREInput {
  uf: string // UF favorecida
  contribuinte: { doc: string; nome: string }
  codigo: string // código receita GNRE (6 dígitos)
  periodo: string // YYYYMM
  valor: number
  multa?: number
  juros?: number
  vencimento: Date
  numeroSequencial?: string
}

export interface GNREOutput {
  numeroDoc: string
  uf: string
  codigo: string
  contribuinteDoc: string
  contribuinteNome: string
  periodo: string
  valorPrincipal: number
  multa: number
  juros: number
  valorTotal: number
  vencimento: Date
  codigoBarras: string
  linhaDigitavel: string
}

export function gerarGNRE(input: GNREInput): GNREOutput {
  const uf = input.uf.toUpperCase()
  if (!UFs.has(uf)) {
    throw new Error(`GNRE: UF inválida (${input.uf})`)
  }
  if (!/^\d{6}$/.test(input.codigo)) {
    throw new Error(`GNRE: código receita deve ter 6 dígitos (${input.codigo})`)
  }
  const multa = input.multa ?? 0
  const juros = input.juros ?? 0
  const valorTotal = Number((input.valor + multa + juros).toFixed(2))
  if (valorTotal <= 0) throw new Error('GNRE: valor total deve ser > 0')

  const seq = (input.numeroSequencial ?? '0001').padStart(4, '0')
  const numeroDoc = `GNRE-${uf}-${input.codigo}-${input.periodo}-${seq}`

  // Campo livre 25 = UF_IBGE(2) + código(6) + periodo(6) + doc últimos 11
  const docOnly = input.contribuinte.doc.replace(/\D/g, '')
  const periodoOnly = input.periodo.replace(/\D/g, '').padStart(6, '0').slice(0, 6)
  const campoLivre =
    UF_IBGE[uf] +
    input.codigo +
    periodoOnly +
    docOnly.padStart(11, '0').slice(-11)

  const { codigoBarras, linhaDigitavel } = montarCodigoBarrasArrecadacao({
    segmento: '7',
    valor: valorTotal,
    empresa: UF_IBGE[uf].padStart(4, '0'),
    campoLivre,
    efetivo: true,
  })

  return {
    numeroDoc,
    uf,
    codigo: input.codigo,
    contribuinteDoc: input.contribuinte.doc,
    contribuinteNome: input.contribuinte.nome,
    periodo: input.periodo,
    valorPrincipal: input.valor,
    multa,
    juros,
    valorTotal,
    vencimento: input.vencimento,
    codigoBarras,
    linhaDigitavel,
  }
}
