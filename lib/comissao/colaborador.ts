/**
 * Motor de cálculo de comissão de COLABORADOR (vendedor interno).
 *
 * Dado o valor vendido por um colaborador num período e a regra dele, calcula
 * o valor de comissão. 4 tipos:
 *   - percentual      → pct% × vendido
 *   - fixo            → valorFixo (por período; ou × nº de negócios se baseFixo='negocio')
 *   - piso_percentual → max(valorFixo, pct% × vendido)   (garantido + variável)
 *   - faixas          → tabela progressiva por teto de volume vendido
 *
 * Puro e testável (sem I/O). A persistência fica nos endpoints.
 */

export type TipoRegraComissao = 'percentual' | 'fixo' | 'piso_percentual' | 'faixas'

export interface FaixaComissao {
  /** Teto de valor vendido (BRL) que esta faixa cobre. null = "acima de tudo". */
  ate: number | null
  /** % aplicado nesta faixa (sobre o total vendido). */
  pct?: number
  /** OU valor fixo nesta faixa (BRL). */
  valor?: number
}

export interface RegraComissao {
  tipo: TipoRegraComissao
  pct?: number | null
  valorFixo?: number | null
  baseFixo?: 'periodo' | 'negocio'
  faixas?: FaixaComissao[] | null
  ativo?: boolean
}

export interface ResultadoComissao {
  valorComissao: number
  /** Faixa/explicação aplicada, para exibir na UI/snapshot. */
  detalhe: string
}

/**
 * Calcula a comissão de um colaborador.
 * @param regra regra individual do colaborador
 * @param vendido valor total vendido no período (BRL)
 * @param qtdNegocios nº de negócios fechados (usado em fixo por negócio)
 */
export function calcularComissaoColaborador(
  regra: RegraComissao,
  vendido: number,
  qtdNegocios = 0,
): ResultadoComissao {
  if (regra.ativo === false) {
    return { valorComissao: 0, detalhe: 'regra inativa' }
  }
  const v = Math.max(0, vendido || 0)

  switch (regra.tipo) {
    case 'percentual': {
      const pct = regra.pct ?? 0
      return { valorComissao: round2(v * (pct / 100)), detalhe: `${fmtPct(pct)} sobre ${fmtBrl(v)}` }
    }

    case 'fixo': {
      const fixo = Number(regra.valorFixo ?? 0)
      if (regra.baseFixo === 'negocio') {
        const total = fixo * Math.max(0, qtdNegocios)
        return { valorComissao: round2(total), detalhe: `${fmtBrl(fixo)} × ${qtdNegocios} negócio(s)` }
      }
      return { valorComissao: round2(fixo), detalhe: `valor fixo no período` }
    }

    case 'piso_percentual': {
      const piso = Number(regra.valorFixo ?? 0)
      const pct = regra.pct ?? 0
      const variavel = v * (pct / 100)
      const valor = Math.max(piso, variavel)
      const detalhe =
        valor === piso
          ? `piso ${fmtBrl(piso)} (≥ ${fmtPct(pct)} = ${fmtBrl(variavel)})`
          : `${fmtPct(pct)} = ${fmtBrl(variavel)} (acima do piso ${fmtBrl(piso)})`
      return { valorComissao: round2(valor), detalhe }
    }

    case 'faixas': {
      const faixas = normalizarFaixas(regra.faixas ?? [])
      if (faixas.length === 0) return { valorComissao: 0, detalhe: 'sem faixas configuradas' }
      // Aplica a faixa cujo teto cobre o valor vendido (primeira `ate` >= v,
      // ou a faixa "acima de" com ate=null).
      const faixa = faixas.find((f) => f.ate == null || v <= f.ate) ?? faixas[faixas.length - 1]
      if (faixa.valor != null) {
        return { valorComissao: round2(faixa.valor), detalhe: `faixa até ${faixa.ate == null ? '∞' : fmtBrl(faixa.ate)} → ${fmtBrl(faixa.valor)}` }
      }
      const pct = faixa.pct ?? 0
      return { valorComissao: round2(v * (pct / 100)), detalhe: `faixa até ${faixa.ate == null ? '∞' : fmtBrl(faixa.ate)} → ${fmtPct(pct)} sobre ${fmtBrl(v)}` }
    }

    default:
      return { valorComissao: 0, detalhe: 'tipo desconhecido' }
  }
}

/** Ordena faixas por teto crescente; faixa `ate=null` ("acima de") vai por último. */
export function normalizarFaixas(faixas: FaixaComissao[]): FaixaComissao[] {
  return [...faixas].sort((a, b) => {
    if (a.ate == null) return 1
    if (b.ate == null) return -1
    return a.ate - b.ate
  })
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
function fmtPct(n: number): string {
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}
