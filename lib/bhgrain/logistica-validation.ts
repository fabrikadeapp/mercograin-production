/**
 * BH Grain — Validações cross-field de Logística (função pura, reaproveitada
 * pela server action `updatePropostaLogistica` e testável isoladamente).
 */

export interface LogisticaInput {
  freteTipo: string | null
  freteCustoTotal: number | null
  freteCustoUnit: number | null
  modalTransporte: string | null
  origem: string | null
  destino: string | null
}

export interface LogisticaValidationResult {
  ok: boolean
  errors: string[]
}

export function validarLogistica(input: LogisticaInput): LogisticaValidationResult {
  const errors: string[] = []

  // 1. frete=incluso → exige custo > 0
  if (input.freteTipo === 'incluso') {
    const hasCusto =
      (input.freteCustoTotal != null && input.freteCustoTotal > 0) ||
      (input.freteCustoUnit != null && input.freteCustoUnit > 0)
    if (!hasCusto) {
      errors.push('Frete incluso exige custo total ou custo/unidade > 0')
    }
  }

  // 2. hidroviário com origem == destino é inconsistente
  if (
    input.modalTransporte === 'hidroviario' &&
    input.origem &&
    input.destino &&
    input.origem === input.destino
  ) {
    errors.push('Modal hidroviário exige origem ≠ destino')
  }

  // 3. Custos negativos
  if (input.freteCustoTotal != null && input.freteCustoTotal < 0) {
    errors.push('Custo total não pode ser negativo')
  }
  if (input.freteCustoUnit != null && input.freteCustoUnit < 0) {
    errors.push('Custo/unidade não pode ser negativo')
  }

  return { ok: errors.length === 0, errors }
}
