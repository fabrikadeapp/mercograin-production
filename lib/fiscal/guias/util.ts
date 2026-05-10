/**
 * Utilitários compartilhados para geração de guias de arrecadação.
 *
 * IMPORTANTE: as rotinas de código de barras / linha digitável aqui geradas
 * seguem o **padrão FEBRABAN para arrecadação (44 dígitos)** com cálculo de
 * DV (módulo 10 / módulo 11). Não substituem o emissor oficial (e-CAC,
 * portais SEFAZ) em produção — servem para preview/print interno e validação.
 *
 * Layout código de barras arrecadação (44 posições, segmento 8):
 *   pos  1     identificação produto (sempre 8 = arrecadação)
 *   pos  2     segmento (1=prefeit, 2=saneamento, 3=energ, 4=tel, 5=banco,
 *              6=gov fed, 7=demais, 9=multas/ipva/dpvat)
 *   pos  3     identificação valor real (6 ou 8 — moeda real) / efetivo
 *   pos  4     DV geral (módulo 10 ou 11 conforme valor)
 *   pos  5-15  valor (11 dígitos, em centavos)
 *   pos 16-19  identificação empresa (FEBRABAN ou órgão)
 *   pos 20-44  campo livre (25 dígitos)
 *
 * Linha digitável: 4 blocos com DV módulo 10 cada.
 */

/**
 * Calcula DV módulo 10 (FEBRABAN, multiplicadores 2,1,2,1...).
 */
export function dvMod10(seq: string): number {
  let soma = 0
  let mult = 2
  for (let i = seq.length - 1; i >= 0; i--) {
    let r = parseInt(seq[i], 10) * mult
    if (r >= 10) r = Math.floor(r / 10) + (r % 10)
    soma += r
    mult = mult === 2 ? 1 : 2
  }
  const resto = soma % 10
  return resto === 0 ? 0 : 10 - resto
}

/**
 * Calcula DV módulo 11 (multiplicadores 2..9 cíclico). Para arrecadação:
 * resultados 0, 10 ou 11 → DV = 1 (regra FEBRABAN guias).
 */
export function dvMod11(seq: string): number {
  let soma = 0
  let mult = 2
  for (let i = seq.length - 1; i >= 0; i--) {
    soma += parseInt(seq[i], 10) * mult
    mult = mult === 9 ? 2 : mult + 1
  }
  const resto = soma % 11
  const dv = 11 - resto
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv
}

/**
 * Centavos com 11 dígitos. Aceita number (R$) ou string.
 */
export function valorCentavos11(valor: number | string): string {
  const n = typeof valor === 'number' ? valor : parseFloat(valor)
  const centavos = Math.round(n * 100)
  return String(centavos).padStart(11, '0').slice(-11)
}

/**
 * Monta o código de barras arrecadação (44 dígitos).
 *
 * @param segmento  '1'..'9'
 * @param valor     em reais
 * @param empresa   4 dígitos (FEBRABAN/órgão)
 * @param campoLivre 25 dígitos (será truncado/zero-pad)
 * @param efetivo   true = identificador valor real (campo 3 = 6); false = referência (8)
 */
export function montarCodigoBarrasArrecadacao(opts: {
  segmento: string
  valor: number
  empresa: string
  campoLivre: string
  efetivo?: boolean
}): { codigoBarras: string; linhaDigitavel: string } {
  const segmento = String(opts.segmento).slice(0, 1).padStart(1, '0')
  const idValor = opts.efetivo === false ? '8' : '6'
  const valor = valorCentavos11(opts.valor)
  const empresa = String(opts.empresa).padStart(4, '0').slice(0, 4)
  const campoLivre = String(opts.campoLivre).replace(/\D/g, '').padStart(25, '0').slice(0, 25)

  // Sequência sem DV: 8 + segmento + idValor + valor(11) + empresa(4) + campoLivre(25) = 43
  const sem = '8' + segmento + idValor + valor + empresa + campoLivre
  // DV: regra FEBRABAN — segmento 6 (gov fed) usa módulo 10, demais idem; nós usamos mod10 (padrão arrecadação).
  const dv = dvMod10(sem).toString()
  const codigoBarras = sem.slice(0, 3) + dv + sem.slice(3) // posição 4 = DV
  if (codigoBarras.length !== 44) {
    throw new Error(`codigo barras gerado com ${codigoBarras.length} dígitos (esperado 44)`)
  }

  // Linha digitável: 4 blocos de 11 + DV mod10 cada → 12 dígitos × 4 = 48
  const blocos = [
    codigoBarras.slice(0, 11),
    codigoBarras.slice(11, 22),
    codigoBarras.slice(22, 33),
    codigoBarras.slice(33, 44),
  ]
  const linhaDigitavel = blocos.map((b) => b + dvMod10(b)).join(' ')

  return { codigoBarras, linhaDigitavel }
}
