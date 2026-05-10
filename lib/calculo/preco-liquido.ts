/**
 * Calculadora de Preço Líquido ao Produtor
 *
 * Lógica pura — não depende de DB nem de framework.
 * Padrão de mercado brasileiro: R$/saca de 60kg (1 ton = 16,667 sc).
 */

export type Grao = 'soja' | 'milho' | 'trigo'
export type Unidade = 'saca' | 'tonelada'

export interface ClassificacaoBase {
  umidadePadrao: number // %
  impurezaPadrao: number // %
}

export const CLASSIFICACAO_PADRAO: Record<Grao, ClassificacaoBase> = {
  soja: { umidadePadrao: 14, impurezaPadrao: 1 },
  milho: { umidadePadrao: 14, impurezaPadrao: 1 },
  trigo: { umidadePadrao: 13, impurezaPadrao: 1 },
}

export const FUNRURAL_ALIQUOTA = 0.013 // 1,2% INSS + 0,1% RAT

export interface DescontoToggle<T> {
  ativo: boolean
  valor: T
}

export interface CalculoInput {
  precoBrutoSc: number // R$/saca 60kg
  quantidadeSc: number // sacas
  grao: Grao
  pessoaFisica: boolean // afeta default do FUNRURAL

  frete: DescontoToggle<{ valorPorSc: number }>
  comissao: DescontoToggle<{ percentual: number }> // ex 1.5 = 1,5%
  funrural: DescontoToggle<Record<string, never>>
  classificacao: DescontoToggle<{ umidade: number; impureza: number }>
  armazenagem: DescontoToggle<{ valorPorScMes: number; meses: number }>
  icms: DescontoToggle<{ percentual: number }>
}

export interface LinhaDesconto {
  rotulo: string
  valor: number // negativo = desconto, positivo = ágio
  detalhe?: string
}

export interface CalculoOutput {
  brutoTotal: number
  brutoPorSc: number
  linhas: LinhaDesconto[]
  liquidoTotal: number
  liquidoPorSc: number
  percentualDescontoEfetivo: number
}

export function calcularPrecoLiquido(input: CalculoInput): CalculoOutput {
  const brutoPorSc = input.precoBrutoSc
  const brutoTotal = brutoPorSc * input.quantidadeSc
  const linhas: LinhaDesconto[] = []

  // 1. Classificação (ágio/deságio simétrico ao desvio do padrão)
  if (input.classificacao.ativo) {
    const { umidade, impureza } = input.classificacao.valor
    const padrao = CLASSIFICACAO_PADRAO[input.grao]
    const deltaU = umidade - padrao.umidadePadrao
    const deltaI = impureza - padrao.impurezaPadrao
    const pct = -(deltaU + deltaI) // umid +1% e imp +0.5% = -1.5%
    const valor = brutoTotal * (pct / 100)
    linhas.push({
      rotulo: 'Classificação',
      valor,
      detalhe: `Umidade ${umidade}% (padrão ${padrao.umidadePadrao}%) · Impureza ${impureza}% (padrão ${padrao.impurezaPadrao}%)`,
    })
  }

  // 2. Frete
  if (input.frete.ativo) {
    const v = -input.frete.valor.valorPorSc * input.quantidadeSc
    linhas.push({
      rotulo: 'Frete',
      valor: v,
      detalhe: `R$ ${input.frete.valor.valorPorSc.toFixed(2)}/sc × ${input.quantidadeSc} sc`,
    })
  }

  // 3. Comissão (sobre bruto)
  if (input.comissao.ativo) {
    const v = -brutoTotal * (input.comissao.valor.percentual / 100)
    linhas.push({
      rotulo: 'Comissão corretora',
      valor: v,
      detalhe: `${input.comissao.valor.percentual}% sobre bruto`,
    })
  }

  // 4. FUNRURAL
  if (input.funrural.ativo) {
    const v = -brutoTotal * FUNRURAL_ALIQUOTA
    linhas.push({
      rotulo: 'FUNRURAL',
      valor: v,
      detalhe: '1,3% (1,2% INSS + 0,1% RAT) sobre bruto',
    })
  }

  // 5. Armazenagem
  if (input.armazenagem.ativo) {
    const { valorPorScMes, meses } = input.armazenagem.valor
    const v = -valorPorScMes * meses * input.quantidadeSc
    linhas.push({
      rotulo: 'Armazenagem',
      valor: v,
      detalhe: `R$ ${valorPorScMes.toFixed(2)}/sc/mês × ${meses} ${meses === 1 ? 'mês' : 'meses'} × ${input.quantidadeSc} sc`,
    })
  }

  // 6. ICMS
  if (input.icms.ativo && input.icms.valor.percentual > 0) {
    const v = -brutoTotal * (input.icms.valor.percentual / 100)
    linhas.push({
      rotulo: 'ICMS',
      valor: v,
      detalhe: `${input.icms.valor.percentual}% sobre bruto`,
    })
  }

  const totalAjustes = linhas.reduce((acc, l) => acc + l.valor, 0)
  const liquidoTotal = brutoTotal + totalAjustes
  const liquidoPorSc = input.quantidadeSc > 0 ? liquidoTotal / input.quantidadeSc : 0
  const percentualDescontoEfetivo =
    brutoTotal > 0 ? ((brutoTotal - liquidoTotal) / brutoTotal) * 100 : 0

  return {
    brutoTotal,
    brutoPorSc,
    linhas,
    liquidoTotal,
    liquidoPorSc,
    percentualDescontoEfetivo,
  }
}

// Conversões saca <-> tonelada (saca padrão 60kg)
export function scParaTonelada(sc: number): number {
  return sc * 0.06
}

export function toneladaParaSc(t: number): number {
  return t / 0.06
}

export function precoSacaParaTonelada(precoSc: number): number {
  // R$/sc → R$/t
  return precoSc / 0.06
}

export function precoToneladaParaSaca(precoT: number): number {
  return precoT * 0.06
}

export function inputVazio(grao: Grao = 'soja', pessoaFisica = true): CalculoInput {
  const padrao = CLASSIFICACAO_PADRAO[grao]
  return {
    precoBrutoSc: 0,
    quantidadeSc: 0,
    grao,
    pessoaFisica,
    frete: { ativo: false, valor: { valorPorSc: 0 } },
    comissao: { ativo: false, valor: { percentual: 1.5 } },
    funrural: { ativo: pessoaFisica, valor: {} },
    classificacao: {
      ativo: false,
      valor: { umidade: padrao.umidadePadrao, impureza: padrao.impurezaPadrao },
    },
    armazenagem: { ativo: false, valor: { valorPorScMes: 0, meses: 0 } },
    icms: { ativo: false, valor: { percentual: 0 } },
  }
}
