/**
 * Exposição cambial agregada — soma dos contratos comerciais em USD versus
 * cobertura via posições de hedge (e/ou NDFs).
 *
 * Heurística de alerta:
 *   alertaSubExposto = hedgeRatio < 0.7 E maior parte dos vencimentos < 90 dias.
 */

export interface ContratoUSDInput {
  valorTotalUSD: number
  vencimento: Date
}

export interface PosicaoUSDInput {
  qtdContratosUSD: number // notional USD da posição na bolsa
  tipo: 'long' | 'short'
}

export interface NDFCambialInput {
  notionalUSD: number
  direcao: 'compra' | 'venda'
}

export interface ExposicaoCambial {
  totalContratosUSD: number
  totalHedgeUSD: number
  totalNdfUSD: number
  exposicaoLiquidaUSD: number
  hedgeRatio: number // 0..1
  alertaSubExposto: boolean
  prazoMedioContratosDias: number
}

export function calcularExposicao(
  contratos: ContratoUSDInput[],
  posicoes: PosicaoUSDInput[],
  ndfs: NDFCambialInput[] = [],
  hoje: Date = new Date(),
): ExposicaoCambial {
  const totalContratosUSD = contratos.reduce(
    (sum, c) => sum + c.valorTotalUSD,
    0,
  )

  // Hedge útil pra exportador (contratos vendidos): SHORT em USD futuro
  // protege contra alta do dólar; consideramos qualquer posição como cobertura
  // proporcional ao notional, sem distinção fina (modelo MVP).
  const totalHedgeUSD = posicoes.reduce(
    (sum, p) => sum + Math.abs(p.qtdContratosUSD),
    0,
  )

  // NDF que VENDE USD futuro também trava câmbio.
  const totalNdfUSD = ndfs.reduce((sum, n) => sum + n.notionalUSD, 0)

  const coberturaTotal = totalHedgeUSD + totalNdfUSD
  const exposicaoLiquidaUSD = totalContratosUSD - coberturaTotal

  const hedgeRatio =
    totalContratosUSD > 0 ? coberturaTotal / totalContratosUSD : 0

  // Prazo médio dos contratos pendentes (dias)
  let prazoMedioContratosDias = 0
  if (contratos.length > 0) {
    const somaDias = contratos.reduce((acc, c) => {
      const dias = (c.vencimento.getTime() - hoje.getTime()) / 86400000
      return acc + Math.max(0, dias)
    }, 0)
    prazoMedioContratosDias = somaDias / contratos.length
  }

  const alertaSubExposto =
    totalContratosUSD > 0 &&
    hedgeRatio < 0.7 &&
    prazoMedioContratosDias < 90 &&
    prazoMedioContratosDias >= 0

  return {
    totalContratosUSD,
    totalHedgeUSD,
    totalNdfUSD,
    exposicaoLiquidaUSD,
    hedgeRatio,
    alertaSubExposto,
    prazoMedioContratosDias,
  }
}

/**
 * Resumo Long × Short por cultura. Útil no dashboard /hedge/long-short.
 */
export interface PosicaoCulturaInput {
  cultura: string
  tipo: 'long' | 'short'
  qtdContratos: number
  notionalUSD: number
}

export interface ResumoLongShortCultura {
  cultura: string
  qtdLong: number
  qtdShort: number
  net: number // long - short (sacas-equiv ou contratos)
  notionalLongUSD: number
  notionalShortUSD: number
  netNotionalUSD: number
}

export function resumirLongShort(
  posicoes: PosicaoCulturaInput[],
): ResumoLongShortCultura[] {
  const map = new Map<string, ResumoLongShortCultura>()
  for (const p of posicoes) {
    let r = map.get(p.cultura)
    if (!r) {
      r = {
        cultura: p.cultura,
        qtdLong: 0,
        qtdShort: 0,
        net: 0,
        notionalLongUSD: 0,
        notionalShortUSD: 0,
        netNotionalUSD: 0,
      }
      map.set(p.cultura, r)
    }
    if (p.tipo === 'long') {
      r.qtdLong += p.qtdContratos
      r.notionalLongUSD += p.notionalUSD
    } else {
      r.qtdShort += p.qtdContratos
      r.notionalShortUSD += p.notionalUSD
    }
  }
  for (const r of map.values()) {
    r.net = r.qtdLong - r.qtdShort
    r.netNotionalUSD = r.notionalLongUSD - r.notionalShortUSD
  }
  return Array.from(map.values()).sort((a, b) => a.cultura.localeCompare(b.cultura))
}
