/**
 * Códigos de vencimento estilo B3/CBOT (ICA — International Commodities Association).
 *
 * Cada mês tem uma letra:
 *   F=Jan G=Feb H=Mar J=Apr K=May M=Jun
 *   N=Jul Q=Aug U=Sep V=Oct X=Nov Z=Dec
 *
 * Ex: K26 = Mai/26, N26 = Jul/26, X26 = Nov/26
 */

const MES_CODIGO: Record<number, string> = {
  0: 'F', 1: 'G', 2: 'H', 3: 'J', 4: 'K', 5: 'M',
  6: 'N', 7: 'Q', 8: 'U', 9: 'V', 10: 'X', 11: 'Z',
}

const MES_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

/** Codigo bolsa: ex `K26` para Mai/26. Usa UTC pra evitar desvio de timezone. */
export function codigoVencimento(date: Date): string {
  const d = new Date(date)
  const mes = MES_CODIGO[d.getUTCMonth()] || ''
  const ano = String(d.getUTCFullYear()).slice(-2)
  return `${mes}${ano}`
}

/** Label PT-BR: ex `Mai/26`. Usa UTC pra estabilidade. */
export function labelVencimento(date: Date): string {
  const d = new Date(date)
  return `${MES_PT[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(-2)}`
}

/** Vencimentos típicos para cada grão na B3. */
const VENCIMENTOS_TIPICOS: Record<string, number[]> = {
  // Mês index (0-based): Mai, Jul, Ago, Set, Nov
  soja: [4, 6, 7, 8, 10],
  // Milho: Jan, Mar, Mai, Jul, Set, Nov
  milho: [0, 2, 4, 6, 8, 10],
  // Trigo: Jul, Set, Dez
  trigo: [6, 8, 11],
  sorgo: [2, 6, 8],
}

export interface VencimentoSugerido {
  ymd: string
  codigo: string
  label: string
  date: Date
}

/** Próximos 6 vencimentos típicos do grão a partir de hoje. */
export function vencimentosTipicos(
  grao: string,
  count = 6,
): VencimentoSugerido[] {
  const meses = VENCIMENTOS_TIPICOS[grao] || VENCIMENTOS_TIPICOS.soja
  const out: VencimentoSugerido[] = []
  const hoje = new Date()
  let ano = hoje.getUTCFullYear()
  let i = 0
  while (out.length < count && i < 24) {
    for (const mes of meses) {
      // Dia 15 evita DST
      const d = new Date(Date.UTC(ano, mes, 15))
      if (d > hoje) {
        const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
        out.push({
          ymd,
          codigo: codigoVencimento(d),
          label: labelVencimento(d),
          date: d,
        })
        if (out.length >= count) break
      }
    }
    ano += 1
    i += 1
  }
  return out
}

/** Atalho legado pedido na spec original. */
export function vencimentosTipicosSoja(): VencimentoSugerido[] {
  return vencimentosTipicos('soja')
}
