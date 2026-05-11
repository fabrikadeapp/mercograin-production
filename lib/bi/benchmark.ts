/**
 * lib/bi/benchmark.ts
 * Benchmark cross-tenant anonimizado.
 *
 * Política de privacidade:
 *  - NUNCA expor nomes/IDs de outros workspaces
 *  - Apenas agregados estatísticos: posição relativa + percentil + média/mediana
 *  - Mínimo de 3 workspaces ativos para liberar o benchmark
 *    (sem isso, posição revelaria identidade)
 *
 * Cache via lib/redis.ts (TTL 1h) — agregação cross-tenant é cara.
 */
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'

export interface BenchmarkMercado {
  posicaoVolume: number | null // posição (1 = melhor) ou null se não atingiu mínimo
  posicaoComissao: number | null
  posicaoTicketMedio: number | null
  totalParticipantes: number
  percentilGlobal: number | null // 0-100, calculado sobre comissao
  medianaComissao: number
  medianaTicketMedio: number
  medianaVolumeT: number
  destaque: {
    melhorComissao: number
    melhorTicket: number
    melhorVolume: number
  }
  habilitado: boolean
  motivo?: string
}

const CACHE_KEY = 'bi:benchmark:v1'
const TTL_SECONDS = 3600
const MIN_PARTICIPANTES = 3

interface TenantStats {
  workspaceId: string
  volumeT: number
  comissaoTotal: number
  ticketMedio: number
}

async function coletarTenantStats(): Promise<TenantStats[]> {
  const now = new Date()
  const ytdStart = new Date(now.getFullYear(), 0, 1)

  // Workspaces ativos (com pelo menos 1 contrato no YTD)
  const workspaces = await db.workspace.findMany({
    select: { id: true },
  })

  const stats: TenantStats[] = []
  for (const w of workspaces) {
    const [tickets, comissoes] = await Promise.all([
      db.ticketBalanca.aggregate({
        where: {
          workspaceId: w.id,
          status: 'finalizado',
          createdAt: { gte: ytdStart },
        },
        _sum: { pesoLiquidoKg: true },
      }),
      db.comissaoApurada.aggregate({
        where: {
          workspaceId: w.id,
          status: { not: 'cancelada' },
          createdAt: { gte: ytdStart },
        },
        _sum: { valorTotalComissao: true, valorContrato: true },
        _count: { _all: true },
      }),
    ])

    const volumeT = Number(tickets._sum.pesoLiquidoKg || 0) / 1000
    const comissaoTotal = Number(comissoes._sum.valorTotalComissao || 0)
    const valorContratos = Number(comissoes._sum.valorContrato || 0)
    const nContratos = comissoes._count._all
    const ticketMedio = nContratos > 0 ? valorContratos / nContratos : 0

    // Filtra workspaces sem atividade — não conta como participante
    if (volumeT === 0 && comissaoTotal === 0 && ticketMedio === 0) continue

    stats.push({
      workspaceId: w.id,
      volumeT,
      comissaoTotal,
      ticketMedio,
    })
  }

  return stats
}

function mediana(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const m = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m]
}

export async function benchmarkMercado(
  workspaceId: string
): Promise<BenchmarkMercado> {
  // Cache
  let stats: TenantStats[] | null = null
  const cached = await redis.get(CACHE_KEY)
  if (cached) {
    try {
      stats = JSON.parse(cached)
    } catch {
      stats = null
    }
  }
  if (!stats) {
    stats = await coletarTenantStats()
    try {
      await redis.setex(CACHE_KEY, TTL_SECONDS, JSON.stringify(stats))
    } catch {
      /* cache best-effort */
    }
  }

  const totalParticipantes = stats.length
  const self = stats.find((s) => s.workspaceId === workspaceId)

  if (totalParticipantes < MIN_PARTICIPANTES) {
    return {
      posicaoVolume: null,
      posicaoComissao: null,
      posicaoTicketMedio: null,
      totalParticipantes,
      percentilGlobal: null,
      medianaComissao: mediana(stats.map((s) => s.comissaoTotal)),
      medianaTicketMedio: mediana(stats.map((s) => s.ticketMedio)),
      medianaVolumeT: mediana(stats.map((s) => s.volumeT)),
      destaque: {
        melhorComissao: Math.max(...stats.map((s) => s.comissaoTotal), 0),
        melhorTicket: Math.max(...stats.map((s) => s.ticketMedio), 0),
        melhorVolume: Math.max(...stats.map((s) => s.volumeT), 0),
      },
      habilitado: false,
      motivo: `Mínimo de ${MIN_PARTICIPANTES} corretoras ativas necessário. Atualmente: ${totalParticipantes}.`,
    }
  }

  const rankBy = (key: keyof TenantStats): number | null => {
    if (!self) return null
    const sorted = [...stats!].sort(
      (a, b) => Number(b[key]) - Number(a[key])
    )
    const idx = sorted.findIndex((s) => s.workspaceId === workspaceId)
    return idx >= 0 ? idx + 1 : null
  }

  const posicaoVolume = rankBy('volumeT')
  const posicaoComissao = rankBy('comissaoTotal')
  const posicaoTicketMedio = rankBy('ticketMedio')

  const percentilGlobal =
    posicaoComissao !== null && totalParticipantes > 1
      ? Math.round(
          ((totalParticipantes - posicaoComissao) / (totalParticipantes - 1)) *
            1000
        ) / 10
      : null

  return {
    posicaoVolume,
    posicaoComissao,
    posicaoTicketMedio,
    totalParticipantes,
    percentilGlobal,
    medianaComissao:
      Math.round(mediana(stats.map((s) => s.comissaoTotal)) * 100) / 100,
    medianaTicketMedio:
      Math.round(mediana(stats.map((s) => s.ticketMedio)) * 100) / 100,
    medianaVolumeT:
      Math.round(mediana(stats.map((s) => s.volumeT)) * 100) / 100,
    destaque: {
      melhorComissao:
        Math.round(Math.max(...stats.map((s) => s.comissaoTotal)) * 100) / 100,
      melhorTicket:
        Math.round(Math.max(...stats.map((s) => s.ticketMedio)) * 100) / 100,
      melhorVolume:
        Math.round(Math.max(...stats.map((s) => s.volumeT)) * 100) / 100,
    },
    habilitado: true,
  }
}
