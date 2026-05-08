import type { Contrato, Cliente, DadosEmpresa, Proposta } from '@prisma/client'

export interface ProductInfo {
  grao: string
  quantidade: number
  preco: number
  subtotal: number
  unidade: string
}

export interface RenderContext {
  empresa: DadosEmpresa | null
  cliente: Cliente
  contrato: Contrato & { proposta?: Proposta | null }
  produto?: ProductInfo
}

const MES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtData(d: Date | null | undefined): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('pt-BR')
}

function fmtDataLonga(d: Date | null | undefined): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  return `${date.getDate()} de ${MES_PT[date.getMonth()]} de ${date.getFullYear()}`
}

/** Naive number-to-words for Brazilian Portuguese, sufficient for currency values up to billions. */
export function valorPorExtenso(valor: number): string {
  if (!isFinite(valor)) return '—'
  const inteiro = Math.floor(valor)
  const cent = Math.round((valor - inteiro) * 100)
  const partes: string[] = []
  if (inteiro > 0) partes.push(`${numToWords(inteiro)} ${inteiro === 1 ? 'real' : 'reais'}`)
  if (cent > 0) partes.push(`${numToWords(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`)
  if (partes.length === 0) return 'zero reais'
  return partes.join(' e ')
}

function numToWords(n: number): string {
  if (n === 0) return 'zero'
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
  const dez19 = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  function abaixoMil(num: number): string {
    if (num === 100) return 'cem'
    const c = Math.floor(num / 100)
    const resto = num % 100
    const parts: string[] = []
    if (c > 0) parts.push(centenas[c])
    if (resto > 0) {
      if (resto < 10) parts.push(unidades[resto])
      else if (resto < 20) parts.push(dez19[resto - 10])
      else {
        const d = Math.floor(resto / 10)
        const u = resto % 10
        parts.push(u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`)
      }
    }
    return parts.join(' e ')
  }

  const grupos: Array<[number, string, string]> = [
    [1_000_000_000, 'bilhão', 'bilhões'],
    [1_000_000, 'milhão', 'milhões'],
    [1_000, 'mil', 'mil'],
  ]
  let resto = n
  const out: string[] = []
  for (const [val, sing, plur] of grupos) {
    const q = Math.floor(resto / val)
    if (q > 0) {
      const palavra = q === 1 && val !== 1_000 ? `um ${sing}` : val === 1_000 ? (q === 1 ? 'mil' : `${abaixoMil(q)} mil`) : `${abaixoMil(q)} ${plur}`
      out.push(palavra)
      resto = resto % val
    }
  }
  if (resto > 0) out.push(abaixoMil(resto))
  return out.join(' e ').replace(/\s+/g, ' ').trim()
}

export function resolveVariable(key: string, ctx: RenderContext): string {
  const path = key.split('.')
  if (path[0] === 'empresa') {
    const e = ctx.empresa
    if (!e) return '—'
    if (path[1] === 'razaoSocial') return e.razaoSocial || '—'
    if (path[1] === 'cnpj') return e.cnpj || '—'
    if (path[1] === 'endereco') return [e.endereco, e.cidade, e.uf].filter(Boolean).join(', ') || '—'
    if (path[1] === 'cidade') return e.cidade || '—'
    if (path[1] === 'uf') return e.uf || '—'
    if (path[1] === 'telefone') return e.telefone || '—'
    if (path[1] === 'email') return e.email || '—'
  }
  if (path[0] === 'cliente') {
    const c = ctx.cliente
    if (path[1] === 'nome') return c.nome
    if (path[1] === 'cnpj') return c.cnpj || '—'
    if (path[1] === 'endereco') return c.endereco || '—'
    if (path[1] === 'telefone') return c.telefone || '—'
    if (path[1] === 'email') return c.email || '—'
  }
  if (path[0] === 'contrato') {
    const ct = ctx.contrato
    if (path[1] === 'numero') return ct.numero
    if (path[1] === 'dataAssinatura') return fmtDataLonga(ct.assinadoEm)
    if (path[1] === 'dataInicio') return fmtData(ct.dataInicio)
    if (path[1] === 'dataFim') return fmtData(ct.dataFim)
    if (path[1] === 'tipo') return ct.proposta?.tipo || '—'
    if (path[1] === 'valorTotal') return ct.proposta ? fmtBRL(Number(ct.proposta.valorTotal)) : '—'
    if (path[1] === 'valorExtenso') return ct.proposta ? valorPorExtenso(Number(ct.proposta.valorTotal)) : '—'
  }
  if (path[0] === 'produto') {
    const p = ctx.produto
    if (!p) return '—'
    if (path[1] === 'grao') return p.grao
    if (path[1] === 'quantidade') return p.quantidade.toLocaleString('pt-BR')
    if (path[1] === 'preco') return fmtBRL(p.preco)
    if (path[1] === 'subtotal') return fmtBRL(p.subtotal)
    if (path[1] === 'unidade') return p.unidade
  }
  if (path[0] === 'hoje') {
    const d = new Date()
    if (path[1] === 'data') return fmtData(d)
    if (path[1] === 'dataLonga') return fmtDataLonga(d)
    if (path[1] === 'cidade') return ctx.empresa?.cidade || '—'
  }
  return `{{${key}}}`
}

/** Recursively replace {{var}} placeholders inside a Tiptap-style JSON document. */
export function resolveContent(content: any, ctx: RenderContext): any {
  if (content == null) return content
  if (typeof content === 'string') {
    return content.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => resolveVariable(key, ctx))
  }
  if (Array.isArray(content)) return content.map((c) => resolveContent(c, ctx))
  if (typeof content === 'object') {
    const out: any = { ...content }
    if (typeof out.text === 'string') out.text = resolveContent(out.text, ctx)
    if (Array.isArray(out.content)) out.content = resolveContent(out.content, ctx)
    return out
  }
  return content
}

/** Same as resolveContent but uses a flat key→value mock map (for previews). */
export function resolveContentMock(content: any, mock: Record<string, string>): any {
  if (content == null) return content
  if (typeof content === 'string') {
    return content.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => mock[key] ?? `{{${key}}}`)
  }
  if (Array.isArray(content)) return content.map((c) => resolveContentMock(c, mock))
  if (typeof content === 'object') {
    const out: any = { ...content }
    if (typeof out.text === 'string') out.text = resolveContentMock(out.text, mock)
    if (Array.isArray(out.content)) out.content = resolveContentMock(out.content, mock)
    return out
  }
  return content
}

/** Extract list of {{var}} keys present in the contentJson. */
export function extractVariables(content: any, acc: Set<string> = new Set()): string[] {
  if (content == null) return Array.from(acc)
  if (typeof content === 'string') {
    const re = /{{\s*([\w.]+)\s*}}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) acc.add(m[1])
    return Array.from(acc)
  }
  if (Array.isArray(content)) {
    content.forEach((c) => extractVariables(c, acc))
    return Array.from(acc)
  }
  if (typeof content === 'object') {
    if (typeof content.text === 'string') extractVariables(content.text, acc)
    if (Array.isArray(content.content)) extractVariables(content.content, acc)
  }
  return Array.from(acc)
}
