/**
 * BH Grain — Classificador/extrator de mensagens (função pura wrapping OpenAI).
 *
 * Estratégia:
 *  - Tenta primeiro classificação heurística por regex (custo zero, baixa latência).
 *  - Só chama OpenAI se a heurística for incerta E houver chave configurada.
 *  - Sempre retorna determinístico em caso de erro (status='erro_leitura').
 *
 * NUNCA envia proposta — só retorna dados estruturados.
 */

import OpenAI from 'openai'

export type IntencaoMensagem =
  | 'pedido_cotacao'
  | 'duvida_comercial'
  | 'follow_up'
  | 'negociacao'
  | 'aceite'
  | 'recusa'
  | 'irrelevante'
  | 'pendencia_operacional'

export interface ClassificationResult {
  intencao: IntencaoMensagem
  status:
    | 'classificado'
    | 'pronta_para_proposta'
    | 'pendente_info'
    | 'nao_comercial'
    | 'erro_leitura'
  commodity?: string
  quantidade?: number
  unidade?: string
  localEntrega?: string
  prazoEntrega?: string
  condicaoPagamento?: string
  urgencia?: 'baixa' | 'media' | 'alta'
  confianca: number // 0..1
  fonte: 'heuristica' | 'openai' | 'erro'
  dadosFaltantes: string[]
}

const COMMODITY_PATTERNS: Array<[RegExp, string]> = [
  [/\bsoja(?:s)?\b/i, 'Soja'],
  [/\bmilho\b/i, 'Milho'],
  [/\btrigo\b/i, 'Trigo'],
  [/\bfarelo(?:\s+de\s+soja)?\b/i, 'Farelo de Soja'],
  [/\bsorgo\b/i, 'Sorgo'],
  [/\barroz\b/i, 'Arroz'],
  [/\baveia\b/i, 'Aveia'],
]

const QTY_REGEX = /(\d{1,3}(?:[.,]?\d{3})*(?:[.,]\d+)?)\s*(sacas?|sc|toneladas?|tons?|tonelada|kg|quilos?|bushels?)/i

const ACEITE_REGEX = /\b(aceito|fechado|fechei|topo|topando|combinado|acordado)\b/i
const RECUSA_REGEX = /\b(não\s+(?:quero|aceito|interessa)|recus(?:o|amos)|sem\s+interesse|desisto)\b/i
const COTACAO_REGEX = /\b(preço|cotação|cotar|cotação|comprar|vender|preciso|interesse)\b/i

export function classificarHeuristica(text: string): ClassificationResult {
  const t = text.trim()
  if (!t) {
    return { intencao: 'irrelevante', status: 'nao_comercial', confianca: 1, fonte: 'heuristica', dadosFaltantes: [] }
  }

  if (ACEITE_REGEX.test(t)) {
    return { intencao: 'aceite', status: 'classificado', confianca: 0.7, fonte: 'heuristica', dadosFaltantes: [] }
  }
  if (RECUSA_REGEX.test(t)) {
    return { intencao: 'recusa', status: 'classificado', confianca: 0.7, fonte: 'heuristica', dadosFaltantes: [] }
  }

  let commodity: string | undefined
  for (const [re, name] of COMMODITY_PATTERNS) {
    if (re.test(t)) {
      commodity = name
      break
    }
  }

  const qm = QTY_REGEX.exec(t)
  let quantidade: number | undefined
  let unidade: string | undefined
  if (qm) {
    const raw = qm[1].replace(/\./g, '').replace(',', '.')
    const n = Number(raw)
    if (Number.isFinite(n)) quantidade = n
    const u = qm[2].toLowerCase()
    if (u.startsWith('sac') || u === 'sc') unidade = 'sc'
    else if (u.startsWith('ton') || u === 'tons') unidade = 'ton'
    else if (u === 'kg' || u.startsWith('quilo')) unidade = 'kg'
    else if (u.startsWith('bushel')) unidade = 'bushel'
  }

  const dadosFaltantes: string[] = []
  if (!commodity) dadosFaltantes.push('commodity')
  if (quantidade == null) dadosFaltantes.push('quantidade')

  if (COTACAO_REGEX.test(t) || (commodity && quantidade != null)) {
    const status = dadosFaltantes.length === 0 ? 'pronta_para_proposta' : 'pendente_info'
    return {
      intencao: 'pedido_cotacao',
      status,
      commodity,
      quantidade,
      unidade,
      confianca: dadosFaltantes.length === 0 ? 0.75 : 0.55,
      fonte: 'heuristica',
      dadosFaltantes,
    }
  }

  return {
    intencao: 'irrelevante',
    status: 'nao_comercial',
    confianca: 0.3,
    fonte: 'heuristica',
    dadosFaltantes: [],
  }
}

/**
 * Versão completa: tenta heurística e refina via OpenAI se confiança < 0.7 e
 * houver chave. Aceita modelo customizado.
 */
export async function classificarMensagem(
  text: string,
  opts: { openaiKey?: string | null; model?: string } = {}
): Promise<ClassificationResult> {
  const heur = classificarHeuristica(text)
  if (heur.confianca >= 0.7 || !opts.openaiKey) return heur

  try {
    const client = new OpenAI({ apiKey: opts.openaiKey })
    const completion = await client.chat.completions.create({
      model: opts.model ?? 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Você é um classificador comercial agrícola. Responda APENAS com JSON estrito: ' +
            '{"intencao":"pedido_cotacao|duvida_comercial|follow_up|negociacao|aceite|recusa|irrelevante|pendencia_operacional", ' +
            '"commodity":string|null,"quantidade":number|null,"unidade":"sc|ton|kg|bushel|null", ' +
            '"localEntrega":string|null,"prazoEntrega":string|null,"condicaoPagamento":string|null, ' +
            '"urgencia":"baixa|media|alta","confianca":0..1}',
        },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    })
    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as Partial<ClassificationResult> & { confianca?: number }

    const dadosFaltantes: string[] = []
    if (!parsed.commodity) dadosFaltantes.push('commodity')
    if (parsed.quantidade == null) dadosFaltantes.push('quantidade')

    const status: ClassificationResult['status'] =
      parsed.intencao === 'pedido_cotacao'
        ? dadosFaltantes.length === 0
          ? 'pronta_para_proposta'
          : 'pendente_info'
        : parsed.intencao === 'irrelevante'
          ? 'nao_comercial'
          : 'classificado'

    return {
      intencao: parsed.intencao ?? 'irrelevante',
      status,
      commodity: parsed.commodity ?? undefined,
      quantidade: parsed.quantidade ?? undefined,
      unidade: parsed.unidade ?? undefined,
      localEntrega: parsed.localEntrega ?? undefined,
      prazoEntrega: parsed.prazoEntrega ?? undefined,
      condicaoPagamento: parsed.condicaoPagamento ?? undefined,
      urgencia: parsed.urgencia ?? 'media',
      confianca: parsed.confianca ?? 0.6,
      fonte: 'openai',
      dadosFaltantes,
    }
  } catch {
    return { ...heur, fonte: 'erro', status: heur.status === 'nao_comercial' ? 'nao_comercial' : 'erro_leitura' }
  }
}

/**
 * Constrói rascunho de proposta a partir da classificação. NUNCA persiste —
 * apenas devolve o payload. O caller decide se cria a proposta (que entrará
 * como 'rascunho_ia' e exigirá aprovação humana via AprovacaoWorkflow).
 */
export interface RascunhoProposta {
  commodity: string
  quantidade: number
  unidade: string
  localEntrega?: string
  prazoEntrega?: string
  condicaoPagamento?: string
  precoSugerido?: number
  cotacaoFonte?: string
  cotacaoCapturadaEm?: string
}

export function montarRascunho(
  c: ClassificationResult,
  preco: { valor: number; fonte: string; capturadaEm: Date } | null
): RascunhoProposta | null {
  if (c.status !== 'pronta_para_proposta' || !c.commodity || c.quantidade == null) return null
  return {
    commodity: c.commodity,
    quantidade: c.quantidade,
    unidade: c.unidade ?? 'sc',
    localEntrega: c.localEntrega,
    prazoEntrega: c.prazoEntrega,
    condicaoPagamento: c.condicaoPagamento,
    precoSugerido: preco?.valor,
    cotacaoFonte: preco?.fonte,
    cotacaoCapturadaEm: preco?.capturadaEm.toISOString(),
  }
}
