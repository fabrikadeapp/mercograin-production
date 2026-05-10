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
  valorContrato: number
): DistribuicaoComissao {
  const v = Number(valorContrato) || 0
  const pctTotal = regra.pctTotal
  const valorTotal = round2((v * pctTotal) / 100)

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

  if (somaPartes <= 0) {
    // Sem distribuição definida: tudo para house
    valorCorretor = 0
    valorOriginador = 0
    valorMesa = 0
    valorHouse = valorTotal
  } else if (somaPartes <= pctTotal + 0.0001) {
    // Cabe dentro do pctTotal — calcular em proporção de valorContrato
    valorCorretor = round2((v * partes.corretor) / 100)
    valorOriginador = round2((v * partes.originador) / 100)
    valorMesa = round2((v * partes.mesa) / 100)
    // House absorve residual (incluindo arredondamentos)
    valorHouse = round2(
      valorTotal - valorCorretor - valorOriginador - valorMesa
    )
    if (valorHouse < 0) valorHouse = 0
  } else {
    // Soma excede pctTotal → normaliza proporcionalmente ao valorTotal
    const k = valorTotal / ((v * somaPartes) / 100)
    valorCorretor = round2(((v * partes.corretor) / 100) * k)
    valorOriginador = round2(((v * partes.originador) / 100) * k)
    valorMesa = round2(((v * partes.mesa) / 100) * k)
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
  }
}
