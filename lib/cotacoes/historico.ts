import { db } from '@/lib/db'

export type Periodo = '7d' | '30d' | '90d' | '1y' | 'all'
export type Grao = 'soja' | 'milho' | 'trigo'

export interface PontoHistorico {
  data: string // ISO date YYYY-MM-DD
  preco: number // R$/sc
  dolarReal: number | null
  volume: number | null
}

export interface SerieHistorica {
  grao: Grao
  pontos: PontoHistorico[]
}

export function periodoParaDias(p: Periodo): number | null {
  switch (p) {
    case '7d':
      return 7
    case '30d':
      return 30
    case '90d':
      return 90
    case '1y':
      return 365
    case 'all':
      return null
  }
}

export async function carregarHistorico(
  graos: Grao[],
  periodo: Periodo,
): Promise<SerieHistorica[]> {
  const dias = periodoParaDias(periodo)
  const since = dias ? new Date(Date.now() - dias * 86400_000) : new Date('2000-01-01')

  const rows = await db.cotacao.findMany({
    where: {
      grao: { in: graos },
      data: { gte: since },
    },
    orderBy: { data: 'asc' },
    select: { grao: true, preco: true, dolarReal: true, volume: true, data: true },
  })

  const buckets = new Map<Grao, PontoHistorico[]>()
  for (const g of graos) buckets.set(g, [])
  for (const r of rows) {
    const ptos = buckets.get(r.grao as Grao)
    if (!ptos) continue
    ptos.push({
      data: r.data.toISOString().slice(0, 10),
      preco: Number(r.preco),
      dolarReal: r.dolarReal !== null ? Number(r.dolarReal) : null,
      volume: r.volume ?? null,
    })
  }

  return graos.map((grao) => ({ grao, pontos: buckets.get(grao) || [] }))
}

/**
 * Média móvel simples — janela de N pontos consecutivos.
 * Retorna array do MESMO comprimento; primeiros (n-1) valores são null.
 */
export function mediaMovel(pontos: number[], janela: number): (number | null)[] {
  const out: (number | null)[] = new Array(pontos.length).fill(null)
  if (janela <= 0 || janela > pontos.length) return out
  let soma = 0
  for (let i = 0; i < pontos.length; i++) {
    soma += pontos[i]
    if (i >= janela) soma -= pontos[i - janela]
    if (i >= janela - 1) out[i] = soma / janela
  }
  return out
}

export interface ResumoSerie {
  inicio: number | null
  atual: number | null
  minimo: number | null
  maximo: number | null
  variacaoPct: number | null
  media: number | null
  pontosTotais: number
}

export function resumoSerie(pontos: PontoHistorico[]): ResumoSerie {
  if (pontos.length === 0) {
    return {
      inicio: null,
      atual: null,
      minimo: null,
      maximo: null,
      variacaoPct: null,
      media: null,
      pontosTotais: 0,
    }
  }
  const precos = pontos.map((p) => p.preco)
  const inicio = precos[0]
  const atual = precos[precos.length - 1]
  const minimo = Math.min(...precos)
  const maximo = Math.max(...precos)
  const media = precos.reduce((s, v) => s + v, 0) / precos.length
  const variacaoPct = inicio === 0 ? null : ((atual - inicio) / inicio) * 100
  return { inicio, atual, minimo, maximo, variacaoPct, media, pontosTotais: precos.length }
}

export function paraRecharts(
  series: SerieHistorica[],
  opts: { mediaMovel?: number[] } = {},
): Record<string, number | string | null>[] {
  const datasUnicas = new Set<string>()
  for (const s of series) for (const p of s.pontos) datasUnicas.add(p.data)
  const datas = Array.from(datasUnicas).sort()

  const resultado: Record<string, number | string | null>[] = datas.map((d) => ({ data: d }))

  for (const s of series) {
    const idxByData = new Map(s.pontos.map((p, i) => [p.data, i]))
    const precos = s.pontos.map((p) => p.preco)
    const mms = (opts.mediaMovel || []).map((j) => ({ janela: j, valores: mediaMovel(precos, j) }))

    for (const row of resultado) {
      const idx = idxByData.get(row.data as string)
      if (idx === undefined) {
        row[s.grao] = null
        for (const mm of mms) row[`${s.grao}MM${mm.janela}`] = null
      } else {
        row[s.grao] = s.pontos[idx].preco
        for (const mm of mms) row[`${s.grao}MM${mm.janela}`] = mm.valores[idx]
      }
    }
  }

  return resultado
}
