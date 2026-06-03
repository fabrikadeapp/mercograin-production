/**
 * Parser de comando livre para criação rápida de propostas.
 *
 * Exemplo de entrada:
 *   "Fazenda São João 1000sc soja 130/sc 30d Sorriso"
 *
 * Saída: estrutura parcial com cliente/grão/quantidade/preço/validade/local/tipo.
 * Tudo opcional — caller decide o que falta. Conversões para canônico
 * (toneladas, R$/t) são feitas aqui usando lib/cotacoes/unidades.ts.
 */

import { KG_POR_BU, KG_POR_SC, type Grao } from '@/lib/cotacoes/unidades'

export type UnidadeQtdEntrada = 't' | 'sc60' | 'kg'
export type UnidadePrecoEntrada = 'brlTon' | 'brlSc60' | 'brlKg' | 'usdBu'

export interface ParseContext {
  /** Câmbio USD→BRL pra converter US$/bu. */
  usdbrl?: number | null
  /** Data de referência (default = now). */
  now?: Date
}

export interface ParsedComando {
  clienteNome?: string
  grao?: Grao
  quantidadeTon?: number
  quantidadeBruta?: { valor: number; unidade: UnidadeQtdEntrada }
  precoBrlTon?: number
  precoBruto?: { valor: number; unidade: UnidadePrecoEntrada }
  validadeEm?: Date
  validadeRelativa?: number
  local?: string
  tipo?: 'venda' | 'compra'
  warnings: string[]
  /** Tokens consumidos (debug). */
  consumido: string[]
}

const GRAO_PATTERNS: Array<[RegExp, Grao]> = [
  [/\bsojas?\b/i, 'soja'],
  [/\bmilhos?\b/i, 'milho'],
  [/\btrigos?\b/i, 'trigo'],
  [/\bsorgos?\b/i, 'sorgo'],
  [/\baveias?\b/i, 'aveia'],
  [/\barroz\b/i, 'arroz'],
  [/\bcaf[eé]\b/i, 'cafe'],
  [/\balgod(?:ão|ao)\b/i, 'algodao'],
]

const TIPO_VENDA_RE = /\b(vender|vendas?|venda|vendo)\b/i
const TIPO_COMPRA_RE = /\b(comprar|compras?|compra|comprando)\b/i

const QTD_RE = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(toneladas?|tons?|ton|t(?![a-zA-Z])|sacas?|sc(?![a-zA-Z])|kg|quilos?)/i

const PRECO_BARRA_RE = /(?:R\$\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*\/\s*(ton|t(?![a-zA-Z])|sc(?![a-zA-Z])|saca|kg|bu)/i
const PRECO_USDBU_RE = /(?:US\$|U\$)\s*(\d+(?:[.,]\d+)?)\s*(?:\/\s*bu)?/i
const PRECO_R_SACA_RE = /R\$\s*(\d+(?:[.,]\d+)?)\s*(?:a|por|\/)?\s*(saca|sc|tonelada|ton|kg)/i

const VALIDADE_DIAS_RE = /(?:em\s+)?(\d{1,3})\s*d(?:ias?)?\b/i
const VALIDADE_DATA_RE = /(?:at[eé]\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/

const LOCAL_RE = /\bem\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wáéíóúâêôãõç-]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wáéíóúâêôãõç-]+){0,3}(?:\s*[/-]\s*[A-Z]{2})?)/

/** Parse principal. Idempotente, sem efeitos colaterais. */
export function parseComando(input: string, ctx: ParseContext = {}): ParsedComando {
  const now = ctx.now ?? new Date()
  const result: ParsedComando = { warnings: [], consumido: [] }
  let resto = ` ${input} `

  // 1. Tipo
  if (TIPO_COMPRA_RE.test(resto)) {
    result.tipo = 'compra'
    resto = resto.replace(TIPO_COMPRA_RE, ' ')
    result.consumido.push('tipo:compra')
  } else if (TIPO_VENDA_RE.test(resto)) {
    result.tipo = 'venda'
    resto = resto.replace(TIPO_VENDA_RE, ' ')
    result.consumido.push('tipo:venda')
  }

  // 2. Grão
  for (const [re, grao] of GRAO_PATTERNS) {
    if (re.test(resto)) {
      result.grao = grao
      resto = resto.replace(re, ' ')
      result.consumido.push(`grao:${grao}`)
      break
    }
  }

  // 3. Preço — testa primeiro padrões mais específicos
  const precoUsdMatch = PRECO_USDBU_RE.exec(resto)
  if (precoUsdMatch) {
    const valor = parseNumeroBR(precoUsdMatch[1])
    if (Number.isFinite(valor)) {
      result.precoBruto = { valor, unidade: 'usdBu' }
      if (ctx.usdbrl && ctx.usdbrl > 0 && result.grao) {
        const kgPorBu = KG_POR_BU[result.grao]
        result.precoBrlTon = (valor * ctx.usdbrl * 1000) / kgPorBu
      } else if (!ctx.usdbrl) {
        result.warnings.push('Preço em US$/bu sem câmbio — preço final indefinido')
      }
      resto = resto.replace(precoUsdMatch[0], ' ')
      result.consumido.push(`preco:${valor}/bu`)
    }
  }

  if (!result.precoBruto) {
    const precoMatch = PRECO_BARRA_RE.exec(resto)
    if (precoMatch) {
      const valor = parseNumeroBR(precoMatch[1])
      const u = precoMatch[2].toLowerCase()
      const unidade = mapearUnidadePreco(u)
      if (Number.isFinite(valor) && unidade) {
        result.precoBruto = { valor, unidade }
        result.precoBrlTon = precoBrutoParaBrlTon(valor, unidade, result.grao, ctx.usdbrl)
        resto = resto.replace(precoMatch[0], ' ')
        result.consumido.push(`preco:${valor}/${u}`)
      }
    }
  }

  if (!result.precoBruto) {
    const precoMatch = PRECO_R_SACA_RE.exec(resto)
    if (precoMatch) {
      const valor = parseNumeroBR(precoMatch[1])
      const u = precoMatch[2].toLowerCase()
      const unidade = mapearUnidadePreco(u)
      if (Number.isFinite(valor) && unidade) {
        result.precoBruto = { valor, unidade }
        result.precoBrlTon = precoBrutoParaBrlTon(valor, unidade, result.grao, ctx.usdbrl)
        resto = resto.replace(precoMatch[0], ' ')
        result.consumido.push(`preco:R$${valor}/${u}`)
      }
    }
  }

  // 4. Quantidade
  const qtdMatch = QTD_RE.exec(resto)
  if (qtdMatch) {
    const valor = parseNumeroBR(qtdMatch[1])
    const u = qtdMatch[2].toLowerCase()
    const unidade = mapearUnidadeQtd(u)
    if (Number.isFinite(valor) && unidade) {
      result.quantidadeBruta = { valor, unidade }
      result.quantidadeTon = qtdBrutaParaTon(valor, unidade, result.grao)
      resto = resto.replace(qtdMatch[0], ' ')
      result.consumido.push(`qtd:${valor}${u}`)
    }
  }

  // 5. Validade — preferência: "30d" antes de "DD/MM"
  const diasMatch = VALIDADE_DIAS_RE.exec(resto)
  if (diasMatch) {
    const dias = parseInt(diasMatch[1], 10)
    if (dias > 0 && dias <= 365) {
      result.validadeRelativa = dias
      result.validadeEm = addDays(now, dias)
      resto = resto.replace(diasMatch[0], ' ')
      result.consumido.push(`validade:+${dias}d`)
    }
  }
  if (!result.validadeEm) {
    const dataMatch = VALIDADE_DATA_RE.exec(resto)
    if (dataMatch) {
      const dia = parseInt(dataMatch[1], 10)
      const mes = parseInt(dataMatch[2], 10) - 1
      let ano = dataMatch[3] ? parseInt(dataMatch[3], 10) : now.getFullYear()
      if (ano < 100) ano += 2000
      const d = new Date(ano, mes, dia)
      if (!isNaN(d.getTime())) {
        // Se data passada e ano não foi informado explicitamente, vira ano seguinte
        if (!dataMatch[3] && d.getTime() < now.getTime()) {
          d.setFullYear(ano + 1)
        }
        result.validadeEm = d
        resto = resto.replace(dataMatch[0], ' ')
        result.consumido.push(`validade:${d.toISOString().slice(0, 10)}`)
      }
    }
  }

  // 6. Local — "em <Cidade>" ou "<Cidade>/UF"
  const localMatch = LOCAL_RE.exec(resto)
  if (localMatch) {
    result.local = limparEspacos(localMatch[1])
    resto = resto.replace(localMatch[0], ' ')
    result.consumido.push(`local:${result.local}`)
  } else {
    // Fallback A: token isolado em formato "Cidade/UF"
    const ufMatch = resto.match(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wáéíóúâêôãõç-]+)\s*[/-]\s*([A-Z]{2})\b/)
    if (ufMatch) {
      result.local = `${ufMatch[1]}/${ufMatch[2]}`
      resto = resto.replace(ufMatch[0], ' ')
      result.consumido.push(`local:${result.local}`)
    } else {
      // Fallback B: último token capitalizado isolado (mín 4 chars) — provável cidade.
      // Só dispara se há > 1 token capitalizado no resto, pra não roubar o nome do cliente.
      const tokensCap = Array.from(
        resto.matchAll(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç-]{3,}\b/g)
      )
      if (tokensCap.length >= 2) {
        const ultimo = tokensCap[tokensCap.length - 1]
        result.local = ultimo[0]
        resto = resto.slice(0, ultimo.index) + ' ' + resto.slice(ultimo.index! + ultimo[0].length)
        result.consumido.push(`local:${result.local}`)
      }
    }
  }

  // 7. Resto = candidato a nome de cliente
  const restante = limparEspacos(
    resto
      .replace(/\b(a|para|pra|com|de|do|da|em|por|até|ate)\b/gi, ' ')
      .replace(/[,;.]/g, ' ')
  )
  if (restante.length >= 2) {
    result.clienteNome = restante
  }

  // 8. Warnings
  if (result.precoBrlTon != null && result.precoBrlTon > 0) {
    if (result.precoBrlTon > 50000) {
      result.warnings.push('Preço acima de R$ 50.000/t — verifique unidade')
    }
    if (result.precoBrlTon < 100) {
      result.warnings.push('Preço abaixo de R$ 100/t — verifique unidade')
    }
  }

  return result
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Parse número PT-BR: "1.000,50" → 1000.5, "1,5" → 1.5, "1000" → 1000.
 * Heurística: se tem ambos . e , o último é decimal. Se só tem um, ambiguidade
 * resolvida assim: vírgula sempre é decimal; ponto só é decimal se NÃO houver
 * 3 dígitos após (separador de milhar).
 */
export function parseNumeroBR(raw: string): number {
  const s = raw.trim()
  if (s.includes(',') && s.includes('.')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  if (s.includes(',')) {
    return parseFloat(s.replace(',', '.'))
  }
  if (s.includes('.')) {
    const partes = s.split('.')
    const ultima = partes[partes.length - 1]
    // Se a última parte tem exatamente 3 dígitos, trata como separador de milhar
    if (ultima.length === 3 && partes.length >= 2) {
      return parseFloat(s.replace(/\./g, ''))
    }
    return parseFloat(s)
  }
  return parseFloat(s)
}

function mapearUnidadeQtd(u: string): UnidadeQtdEntrada | null {
  if (u.startsWith('ton') || u === 't') return 't'
  if (u.startsWith('sac') || u === 'sc') return 'sc60'
  if (u === 'kg' || u.startsWith('quilo')) return 'kg'
  return null
}

function mapearUnidadePreco(u: string): UnidadePrecoEntrada | null {
  if (u.startsWith('ton') || u === 't' || u === 'tonelada') return 'brlTon'
  if (u === 'sc' || u === 'saca') return 'brlSc60'
  if (u === 'kg') return 'brlKg'
  if (u === 'bu') return 'usdBu'
  return null
}

function qtdBrutaParaTon(valor: number, unidade: UnidadeQtdEntrada, grao: Grao | undefined): number {
  if (unidade === 't') return valor
  if (unidade === 'kg') return valor / 1000
  if (unidade === 'sc60') {
    const kgPorSc = grao ? KG_POR_SC[grao] : 60
    return (valor * kgPorSc) / 1000
  }
  return valor
}

function precoBrutoParaBrlTon(
  valor: number,
  unidade: UnidadePrecoEntrada,
  grao: Grao | undefined,
  usdbrl?: number | null
): number | undefined {
  if (unidade === 'brlTon') return valor
  if (unidade === 'brlKg') return valor * 1000
  if (unidade === 'brlSc60') {
    const kgPorSc = grao ? KG_POR_SC[grao] : 60
    return (valor / kgPorSc) * 1000
  }
  if (unidade === 'usdBu') {
    if (!usdbrl || usdbrl <= 0 || !grao) return undefined
    const kgPorBu = KG_POR_BU[grao]
    return (valor * usdbrl * 1000) / kgPorBu
  }
  return undefined
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function limparEspacos(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}
