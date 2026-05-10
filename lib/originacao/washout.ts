/**
 * Cálculo de impacto de washout (desfazimento de contrato).
 *
 * Devolve qtd liberada do contrato, custo total estimado, e o impacto
 * em fixações e adiantamentos abertos.
 */

export interface FixacaoSnapshot {
  id: string
  qtdSc: number
  precoSc: number
}

export interface AdiantamentoSnapshot {
  id: string
  valor: number
  qtdEsperadaSc: number
  qtdAbatidaSc: number
  status: string
}

export interface WashoutInput {
  contratoId: string
  qtdContratadaSc: number
  qtdJaFixadaSc?: number
  custoWashout?: number
  fixacoesAbertas?: FixacaoSnapshot[]
  adiantamentosAbertos?: AdiantamentoSnapshot[]
}

export interface WashoutImpacto {
  qtdLiberada: number
  custoTotalEstimado: number
  contratoId: string
  fixacoesCanceladas: number
  qtdFixacoesCanceladasSc: number
  adiantamentosAReembolsar: number
  valorAReembolsar: number
  alertas: string[]
}

export function calcularImpactoWashout(input: WashoutInput): WashoutImpacto {
  const alertas: string[] = []

  const qtdLiberada = Math.max(
    0,
    (input.qtdContratadaSc || 0) - (input.qtdJaFixadaSc || 0)
  )

  const fixacoes = input.fixacoesAbertas || []
  const fixacoesCanceladas = fixacoes.length
  const qtdFixacoesCanceladasSc = fixacoes.reduce(
    (acc, f) => acc + (isFinite(f.qtdSc) ? f.qtdSc : 0),
    0
  )

  const adiantamentos = input.adiantamentosAbertos || []
  const adiantamentosAReembolsar = adiantamentos.filter(
    (a) => a.status !== 'quitado' && a.status !== 'cancelado'
  ).length

  const valorAReembolsar = adiantamentos.reduce((acc, a) => {
    if (a.status === 'quitado' || a.status === 'cancelado') return acc
    // Saldo proporcional: valor * (1 - abatida/esperada)
    const ratio =
      a.qtdEsperadaSc > 0
        ? Math.max(0, 1 - a.qtdAbatidaSc / a.qtdEsperadaSc)
        : 1
    return acc + (isFinite(a.valor) ? a.valor : 0) * ratio
  }, 0)

  const custoTotalEstimado = (input.custoWashout || 0) + valorAReembolsar

  if (qtdFixacoesCanceladasSc > 0) {
    alertas.push(
      `${fixacoesCanceladas} fixações (${qtdFixacoesCanceladasSc.toFixed(
        2
      )} sc) serão canceladas`
    )
  }
  if (adiantamentosAReembolsar > 0) {
    alertas.push(
      `${adiantamentosAReembolsar} adiantamento(s) com saldo a reembolsar (R$ ${valorAReembolsar.toFixed(
        2
      )})`
    )
  }

  return {
    qtdLiberada,
    custoTotalEstimado,
    contratoId: input.contratoId,
    fixacoesCanceladas,
    qtdFixacoesCanceladasSc,
    adiantamentosAReembolsar,
    valorAReembolsar,
    alertas,
  }
}
