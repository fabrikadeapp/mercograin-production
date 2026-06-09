/**
 * Comissão — seleção de regra + distribuição.
 *
 * Cada ComissaoRegra define pctTotal sobre o valor do contrato; o total é
 * dividido entre corretor / originador / mesa / house de acordo com pcts.
 *
 * Se a soma das partes não fechar em pctTotal, o restante vai para house
 * (residual). Se ultrapassar pctTotal, normaliza proporcionalmente.
 */

export interface RegraInput {
  id?: string
  pctTotal: number
  pctCorretor: number
  pctOriginador?: number | null
  pctMesa?: number | null
  pctHouse?: number | null
  escopoTipo?: string | null
  escopoFiltro?: Record<string, any> | null
  ativo?: boolean
  prioridade?: number
  // F1-05 — corretagem completa
  /** 'percentual' (default) | 'por_tonelada' */
  baseCalculo?: string | null
  /** R$/ton quando baseCalculo='por_tonelada' */
  valorPorTonelada?: number | null
  /** 'comprador' (default) | 'vendedor' | 'ambos' */
  quemPaga?: string | null
  /** % que cabe ao comprador quando quemPaga='ambos' (resto ao vendedor) */
  rateioCompradorPct?: number | null
}

export interface ContratoCtx {
  cultura?: string | null
  mesaId?: string | null
  corretorId?: string | null
  clienteId?: string | null
}

export interface DistribuicaoComissao {
  valorTotal: number
  corretor: number
  originador: number
  mesa: number
  house: number
  /** Quem paga (snapshot) e rateio entre contrapartes. */
  quemPaga: string
  valorComprador: number
  valorVendedorPaga: number
}

/** True se a regra (escopo + filtro) aplica ao contexto do contrato. */
export function aplicaRegraEm(regra: RegraInput, ctx: ContratoCtx): boolean {
  if (regra.ativo === false) return false
  const tipo = regra.escopoTipo
  if (!tipo || tipo === 'global') return true
  const filtro = regra.escopoFiltro ?? {}
  switch (tipo) {
    case 'cultura':
      return !filtro.cultura || filtro.cultura === ctx.cultura
    case 'mesa':
      return !filtro.mesaId || filtro.mesaId === ctx.mesaId
    case 'corretor':
      return !filtro.corretorId || filtro.corretorId === ctx.corretorId
    case 'cliente':
      return !filtro.clienteId || filtro.clienteId === ctx.clienteId
    default:
      return true
  }
}

/**
 * Escolhe regra de maior prioridade (default 0) que aplica. Tie-break:
 * regra mais específica (escopoTipo != global) > global, depois por id estável.
 */
export function selecionarRegra<T extends RegraInput>(
  regras: T[],
  ctx: ContratoCtx
): T | null {
  const aplicaveis = regras.filter((r) => aplicaRegraEm(r, ctx))
  if (!aplicaveis.length) return null
  aplicaveis.sort((a, b) => {
    const pa = b.prioridade ?? 0
    const pb = a.prioridade ?? 0
    if (pa !== pb) return pa - pb // maior prioridade primeiro (b - a)
    const espA = a.escopoTipo && a.escopoTipo !== 'global' ? 1 : 0
    const espB = b.escopoTipo && b.escopoTipo !== 'global' ? 1 : 0
    if (espA !== espB) return espB - espA
    return (a.id ?? '').localeCompare(b.id ?? '')
  })
  return aplicaveis[0]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function distribuirComissao(
  regra: RegraInput,
  valorContrato: number,
  toneladas = 0
): DistribuicaoComissao {
  const v = Number(valorContrato) || 0
  const pctTotal = regra.pctTotal

  // Base de cálculo: percentual (default) ou R$ por tonelada.
  const valorTotal =
    regra.baseCalculo === 'por_tonelada'
      ? round2((Number(regra.valorPorTonelada) || 0) * (Number(toneladas) || 0))
      : round2((v * pctTotal) / 100)

  // "Quem paga" + rateio entre contrapartes (sobre o total da corretagem).
  const quemPaga = regra.quemPaga || 'comprador'
  let valorComprador = 0
  let valorVendedorPaga = 0
  if (quemPaga === 'comprador') {
    valorComprador = valorTotal
  } else if (quemPaga === 'vendedor') {
    valorVendedorPaga = valorTotal
  } else {
    const pctComp = regra.rateioCompradorPct == null ? 100 : regra.rateioCompradorPct
    valorComprador = round2((valorTotal * pctComp) / 100)
    valorVendedorPaga = round2(valorTotal - valorComprador)
  }

  const partes = {
    corretor: regra.pctCorretor || 0,
    originador: regra.pctOriginador || 0,
    mesa: regra.pctMesa || 0,
    house: regra.pctHouse || 0,
  }
  const somaPartes =
    partes.corretor + partes.originador + partes.mesa + partes.house

  let valorCorretor: number
  let valorOriginador: number
  let valorMesa: number
  let valorHouse: number

  // A distribuição entre as partes é proporcional aos pcts informados, mas
  // SEMPRE normalizada para somar exatamente `valorTotal` (funciona tanto para
  // base percentual quanto por_tonelada — o "todo" a repartir é valorTotal).
  if (somaPartes <= 0 || valorTotal <= 0) {
    valorCorretor = 0
    valorOriginador = 0
    valorMesa = 0
    valorHouse = valorTotal
  } else {
    valorCorretor = round2((valorTotal * partes.corretor) / somaPartes)
    valorOriginador = round2((valorTotal * partes.originador) / somaPartes)
    valorMesa = round2((valorTotal * partes.mesa) / somaPartes)
    valorHouse = round2(
      valorTotal - valorCorretor - valorOriginador - valorMesa
    )
    if (valorHouse < 0) valorHouse = 0
  }

  return {
    valorTotal,
    corretor: valorCorretor,
    originador: valorOriginador,
    mesa: valorMesa,
    house: valorHouse,
    quemPaga,
    valorComprador,
    valorVendedorPaga,
  }
}
