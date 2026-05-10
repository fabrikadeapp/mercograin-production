/**
 * Gerador DARF — Documento de Arrecadação de Receitas Federais.
 *
 * Códigos de receita usuais:
 *   0220 IRPF (carnê-leão)
 *   2089 IRPJ Lucro Real
 *   5952 PIS Faturamento
 *   5856 COFINS Faturamento
 *   6912 CSLL Lucro Real
 *   1708 IRRF s/ serviços PJ
 *
 * O DARF é segmento 6 (governo federal) no padrão FEBRABAN arrecadação.
 */

import { montarCodigoBarrasArrecadacao } from './util'

export interface DARFInput {
  codigo: string // código receita
  contribuinte: { doc: string; nome: string }
  /** Período apuração: YYYYMM ou YYYYMMDD. */
  periodo: string
  valor: number // principal
  multa?: number
  juros?: number
  vencimento: Date
  /** Sequencial interno (4 dígitos, default '0001'). */
  numeroSequencial?: string
}

export interface DARFOutput {
  numeroDoc: string
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

export function gerarDARF(input: DARFInput): DARFOutput {
  const multa = input.multa ?? 0
  const juros = input.juros ?? 0
  const valorTotal = Number((input.valor + multa + juros).toFixed(2))

  if (valorTotal <= 0) {
    throw new Error('DARF: valor total deve ser maior que zero')
  }
  if (!/^\d{4}(-\d{2})?$/.test(input.codigo)) {
    throw new Error(`DARF: código receita inválido (${input.codigo})`)
  }

  const seq = (input.numeroSequencial ?? '0001').padStart(4, '0')
  const numeroDoc = `DARF-${input.codigo}-${input.periodo}-${seq}`

  // Campo livre 25 = código(4) + período(8) + cpf/cnpj últimos 11 + seq(2)
  const docOnly = input.contribuinte.doc.replace(/\D/g, '')
  const periodoOnly = input.periodo.replace(/\D/g, '').padEnd(8, '0').slice(0, 8)
  const campoLivre =
    input.codigo.replace(/\D/g, '').padStart(4, '0') +
    periodoOnly +
    docOnly.padStart(11, '0').slice(-11) +
    seq.slice(-2)

  const { codigoBarras, linhaDigitavel } = montarCodigoBarrasArrecadacao({
    segmento: '6', // governo federal
    valor: valorTotal,
    empresa: '0001', // RFB
    campoLivre,
    efetivo: true,
  })

  return {
    numeroDoc,
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
