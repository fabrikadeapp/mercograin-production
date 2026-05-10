/**
 * Gerador GARE-ICMS — Guia de Arrecadação Estadual de São Paulo.
 * Modelo simplificado p/ ICMS, ITCMD, IPVA-SP.
 *
 * Códigos receita SP usuais:
 *   046-2 ICMS — Regime Periódico de Apuração
 *   063-3 ICMS — Substituição Tributária
 *   115-0 ICMS — Recolhimentos especiais
 *
 * Segmento 7 (governo estadual) no padrão FEBRABAN.
 */

import { montarCodigoBarrasArrecadacao } from './util'

export interface GAREInput {
  contribuinte: { doc: string; nome: string; ie?: string }
  codigo: string // código receita SP
  periodo: string // YYYYMM
  valor: number
  multa?: number
  juros?: number
  vencimento: Date
  numeroSequencial?: string
}

export interface GAREOutput {
  numeroDoc: string
  uf: 'SP'
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

export function gerarGARE(input: GAREInput): GAREOutput {
  const codigoLimpo = input.codigo.replace(/\D/g, '')
  if (!/^\d{3,4}$/.test(codigoLimpo)) {
    throw new Error(`GARE: código receita inválido (${input.codigo})`)
  }
  const multa = input.multa ?? 0
  const juros = input.juros ?? 0
  const valorTotal = Number((input.valor + multa + juros).toFixed(2))
  if (valorTotal <= 0) throw new Error('GARE: valor total deve ser > 0')

  const seq = (input.numeroSequencial ?? '0001').padStart(4, '0')
  const numeroDoc = `GARE-SP-${codigoLimpo}-${input.periodo}-${seq}`

  const docOnly = input.contribuinte.doc.replace(/\D/g, '')
  const periodoOnly = input.periodo.replace(/\D/g, '').padStart(6, '0').slice(0, 6)
  const ieOnly = (input.contribuinte.ie ?? '').replace(/\D/g, '').padStart(12, '0').slice(-12)

  const campoLivre =
    '35' + // IBGE SP
    codigoLimpo.padStart(4, '0') +
    periodoOnly +
    ieOnly.slice(-12) +
    seq.slice(-1)

  const { codigoBarras, linhaDigitavel } = montarCodigoBarrasArrecadacao({
    segmento: '7',
    valor: valorTotal,
    empresa: '3500', // SP / SEFAZ
    campoLivre: campoLivre.padEnd(25, '0').slice(0, 25),
    efetivo: true,
  })

  return {
    numeroDoc,
    uf: 'SP',
    codigo: codigoLimpo,
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
