/**
 * Cálculo de P&L de posições de hedge — Long/Short, com decomposição
 * preço CBOT vs efeito cambial.
 *
 * Convenções:
 *  - Long lucra com alta do preço (compra hoje, vende depois mais caro).
 *  - Short lucra com queda (vende hoje no futuro, recompra depois mais barato).
 *  - 1 contrato CBOT = 5000 bushels.
 *  - PnL USD = (precoMkt - precoEntrada) * sinal * qtdContratos * 5000  -  corretagem
 *  - PnL BRL = pnlUSD * cambioMkt + (cambioMkt - cambioEntrada) * notionalUSD
 *
 * Decomposição:
 *  - pnlPrecoUSD: efeito puramente do movimento do preço CBOT (em USD).
 *  - pnlCambialUSD: ganho/perda atribuível à variação de USD/BRL aplicada
 *    sobre o notional (referência em USD da posição na entrada).
 */

import { CBOT_CONTRATO, type CulturaCbot } from './conversao'

export interface PosicaoInput {
  tipo: 'long' | 'short'
  qtdContratos: number
  cultura: CulturaCbot
  precoEntradaUsdBu: number
  cambioEntradaUsdBrl: number
  corretagemUSD?: number
}

export interface PrecoMercadoInput {
  precoMercadoUsdBu: number
  cambioMercadoUsdBrl: number
}

export interface PnLResult {
  pnlUSD: number
  pnlBRL: number
  pnlPctEntrada: number
  pnlPrecoUSD: number
  pnlCambialUSD: number
  notionalEntradaUSD: number
}

const BUSHELS_POR_CONTRATO = 5000

export function calcularPnL(
  pos: PosicaoInput,
  mkt: PrecoMercadoInput,
): PnLResult {
  if (!CBOT_CONTRATO[pos.cultura]) {
    throw new Error(`Cultura CBOT inválida: ${pos.cultura}`)
  }
  if (pos.qtdContratos <= 0) throw new Error('qtdContratos deve ser > 0')
  if (pos.precoEntradaUsdBu <= 0) throw new Error('precoEntradaUsdBu inválido')
  if (pos.cambioEntradaUsdBrl <= 0) throw new Error('cambioEntradaUsdBrl inválido')
  if (mkt.cambioMercadoUsdBrl <= 0) throw new Error('cambioMercadoUsdBrl inválido')

  const sinal = pos.tipo === 'long' ? 1 : -1
  const corretagem = pos.corretagemUSD ?? 0

  const deltaPrecoUsdBu = mkt.precoMercadoUsdBu - pos.precoEntradaUsdBu
  const tamanhoUSD = pos.qtdContratos * BUSHELS_POR_CONTRATO

  // P&L em USD: variação de preço aplicada à quantidade de bushels.
  const pnlPrecoUSD = sinal * deltaPrecoUsdBu * tamanhoUSD - corretagem
  const pnlUSD = pnlPrecoUSD

  // Notional em USD na entrada (valor de referência da posição)
  const notionalEntradaUSD = pos.precoEntradaUsdBu * tamanhoUSD

  // Efeito cambial: o notional flutua quando convertido pra BRL conforme câmbio muda.
  const deltaCambio = mkt.cambioMercadoUsdBrl - pos.cambioEntradaUsdBrl
  const pnlCambialUSD =
    (deltaCambio * notionalEntradaUSD) / mkt.cambioMercadoUsdBrl
  // Aproximação: efeito cambial separado expresso em USD-equivalente.

  // P&L total em BRL: P&L em USD convertido pelo câmbio atual + variação cambial
  // sobre o notional (capital alocado na entrada).
  const pnlBRL =
    pnlUSD * mkt.cambioMercadoUsdBrl + deltaCambio * notionalEntradaUSD

  const pnlPctEntrada =
    notionalEntradaUSD > 0 ? (pnlUSD / notionalEntradaUSD) * 100 : 0

  return {
    pnlUSD,
    pnlBRL,
    pnlPctEntrada,
    pnlPrecoUSD,
    pnlCambialUSD,
    notionalEntradaUSD,
  }
}

/**
 * P&L final ao fechar a posição. Usa o preço/câmbio de saída.
 */
export function calcularPnLFinal(
  pos: PosicaoInput,
  saida: { precoSaidaUsdBu: number; cambioSaidaUsdBrl: number },
): PnLResult {
  return calcularPnL(pos, {
    precoMercadoUsdBu: saida.precoSaidaUsdBu,
    cambioMercadoUsdBrl: saida.cambioSaidaUsdBrl,
  })
}
