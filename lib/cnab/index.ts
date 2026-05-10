/**
 * CNAB retorno — detecção automática 240 vs 400 e parsing.
 */
import { parseCnab240 } from './cnab240'
import { parseCnab400 } from './cnab400'
import type { CnabRetorno } from './types'

export * from './types'
export { parseCnab240, parseCnab400 }

/**
 * Detecta layout pelo tamanho da 1ª linha não-vazia e roteia para o parser.
 *
 *  - 240 ± 5 chars → CNAB 240
 *  - 400 ± 5 chars → CNAB 400
 *  - outros → error
 */
export function parseCnab(content: string): CnabRetorno {
  const first =
    content.split(/\r?\n/).find((l) => l.length > 0) ?? ''
  const len = first.length
  if (len >= 235 && len <= 245) return parseCnab240(content)
  if (len >= 395 && len <= 405) return parseCnab400(content)
  return {
    header: { banco: '000', layout: len < 300 ? '240' : '400' },
    detalhes: [],
    totalRegistros: 0,
    totalValorPago: 0,
    errors: [
      `Layout não reconhecido: 1ª linha tem ${len} chars (esperado 240 ou 400)`,
    ],
  }
}
