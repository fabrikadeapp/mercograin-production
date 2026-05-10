/**
 * Fixação de preço sobre contratos "a fixar".
 *
 * Regras:
 *  - qtd a fixar > 0
 *  - qtdFixada + qtdSc <= qtdTotal (excesso = ERRO bloqueante)
 *  - se fixacaoFim < hoje => ALERTA (não bloqueia, corretora decide)
 *  - novo status: 'totalmente_fixado' se fica == total (com epsilon),
 *                 'parcial' se 0 < fixada < total,
 *                 'pendente' se 0.
 */

export type StatusFixacao =
  | 'pendente'
  | 'parcial'
  | 'totalmente_fixado'
  | 'cancelado'

export interface ContratoFixacaoSnapshot {
  qtdTotalSc: number
  qtdFixadaSc: number
  fixacaoFim?: Date | null
}

export interface FixacaoInput {
  contratoFixacao: ContratoFixacaoSnapshot
  qtdSc: number
  precoSc: number
  cotacaoUSDBRL?: number
  premio?: number
  base?: number
  agora?: Date // injetável p/ teste
}

export interface ResultadoFixacao {
  ok: boolean
  novaQtdFixada: number
  novaQtdRemanescente: number
  novoStatus: StatusFixacao
  alertas: string[]
  erros: string[]
}

const EPS = 1e-6

export function aplicarFixacao(input: FixacaoInput): ResultadoFixacao {
  const erros: string[] = []
  const alertas: string[] = []

  const { contratoFixacao, qtdSc, precoSc } = input
  const agora = input.agora ?? new Date()

  if (!isFinite(qtdSc) || qtdSc <= 0) {
    erros.push('qtdSc deve ser maior que zero')
  }
  if (!isFinite(precoSc) || precoSc <= 0) {
    erros.push('precoSc deve ser maior que zero')
  }
  if (!isFinite(contratoFixacao.qtdTotalSc) || contratoFixacao.qtdTotalSc <= 0) {
    erros.push('qtdTotalSc do contrato inválida')
  }

  const fixadaAtual = Math.max(0, contratoFixacao.qtdFixadaSc || 0)
  const total = contratoFixacao.qtdTotalSc
  const restante = Math.max(0, total - fixadaAtual)

  if (qtdSc > restante + EPS) {
    erros.push(
      `qtd a fixar (${qtdSc}) excede saldo remanescente (${restante.toFixed(
        2
      )})`
    )
  }

  if (
    contratoFixacao.fixacaoFim &&
    contratoFixacao.fixacaoFim instanceof Date &&
    contratoFixacao.fixacaoFim.getTime() < agora.getTime()
  ) {
    alertas.push('janela de fixação vencida — proceder requer autorização')
  }

  if (erros.length > 0) {
    return {
      ok: false,
      novaQtdFixada: fixadaAtual,
      novaQtdRemanescente: restante,
      novoStatus: deriveStatus(fixadaAtual, total),
      alertas,
      erros,
    }
  }

  const novaQtdFixada = fixadaAtual + qtdSc
  const novaQtdRemanescente = Math.max(0, total - novaQtdFixada)
  const novoStatus = deriveStatus(novaQtdFixada, total)

  return {
    ok: true,
    novaQtdFixada,
    novaQtdRemanescente,
    novoStatus,
    alertas,
    erros,
  }
}

function deriveStatus(fixada: number, total: number): StatusFixacao {
  if (fixada <= EPS) return 'pendente'
  if (Math.abs(fixada - total) <= EPS || fixada >= total - EPS)
    return 'totalmente_fixado'
  return 'parcial'
}

/** Calcula preço efetivo da fixação considerando premio/base. */
export function precoEfetivoSc(
  precoSc: number,
  premio?: number | null,
  base?: number | null
): number {
  return precoSc + (premio || 0) + (base || 0)
}
