/**
 * Cálculo do saldo de um lote a partir de movimentações.
 *
 * Convenção:
 *  - 'entrada' soma qtdSc
 *  - 'saida' / 'quebra_tecnica' / 'rebaixe' / 'transferencia' subtraem qtdSc
 *  - qtdSc é sempre armazenado positivo; o tipo determina o sinal.
 */

export type TipoMovimentacao =
  | 'entrada'
  | 'saida'
  | 'transferencia'
  | 'quebra_tecnica'
  | 'rebaixe'

export interface Movimentacao {
  tipo: TipoMovimentacao
  qtdSc: number
}

const SAIDAS: ReadonlyArray<TipoMovimentacao> = [
  'saida',
  'transferencia',
  'quebra_tecnica',
  'rebaixe',
]

export function isSaida(tipo: TipoMovimentacao): boolean {
  return SAIDAS.includes(tipo)
}

export function calcularSaldoLote(
  qtdInicialSc: number,
  movimentacoes: Movimentacao[]
): number {
  let saldo = qtdInicialSc
  for (const m of movimentacoes) {
    const q = Math.abs(m.qtdSc)
    if (isSaida(m.tipo)) saldo -= q
    else if (m.tipo === 'entrada') saldo += q
  }
  return Math.round(saldo * 100) / 100
}

export interface SaldoBreakdown {
  qtdInicialSc: number
  totalEntradasSc: number
  totalSaidasSc: number
  totalQuebrasSc: number
  totalTransferidoSc: number
  totalRebaixeSc: number
  saldoFinalSc: number
}

export function breakdownLote(
  qtdInicialSc: number,
  movimentacoes: Movimentacao[]
): SaldoBreakdown {
  let entradas = 0,
    saidas = 0,
    quebras = 0,
    transf = 0,
    rebaixe = 0
  for (const m of movimentacoes) {
    const q = Math.abs(m.qtdSc)
    switch (m.tipo) {
      case 'entrada':
        entradas += q
        break
      case 'saida':
        saidas += q
        break
      case 'quebra_tecnica':
        quebras += q
        break
      case 'transferencia':
        transf += q
        break
      case 'rebaixe':
        rebaixe += q
        break
    }
  }
  const r = (v: number) => Math.round(v * 100) / 100
  return {
    qtdInicialSc: r(qtdInicialSc),
    totalEntradasSc: r(entradas),
    totalSaidasSc: r(saidas),
    totalQuebrasSc: r(quebras),
    totalTransferidoSc: r(transf),
    totalRebaixeSc: r(rebaixe),
    saldoFinalSc: r(qtdInicialSc + entradas - saidas - quebras - transf - rebaixe),
  }
}
