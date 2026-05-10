/**
 * S5 M9 — Adapter sobreposição IBAMA/FUNAI/ICMBio.
 *
 * Verifica se a propriedade rural sobrepõe áreas embargadas (IBAMA), Terras
 * Indígenas (FUNAI) ou Unidades de Conservação (ICMBio).
 *
 * Estratégia ZERO-CUSTO:
 *  1) Tabela AreaProtegida no DB (populada por cron mensal — TODO)
 *  2) Cálculo local com aproximação por bbox-overlap (sem turf)
 *
 * Limitação conhecida: bbox-overlap aceita falsos positivos. Para precisão
 * geométrica real, instalar @turf/intersect e substituir `bboxOverlap` por
 * `turf.booleanIntersects`.
 */
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { calcularBbox as _calcularBbox, bboxOverlap, bboxOverlapPct } from './geo-bbox'

// Reexport para manter API estável
export const calcularBbox = _calcularBbox

const CACHE_TTL = 60 * 60 * 24 // 24h

export interface SobreposicaoArea {
  id: string
  tipo: 'terra_indigena' | 'unidade_conservacao' | 'embargo_ibama' | string
  nome: string
  uf: string | null
  fonte: string
  overlapPct: number
}

export interface SobreposicaoResultado {
  temSobreposicao: boolean
  areas: SobreposicaoArea[]
  consultadoEm: string
  fonte: 'local_db' | 'mock'
  cacheMiss?: boolean
}


export interface VerificarSobreposicaoOpts {
  geoJson: any
  uf?: string
  tipos?: Array<'terra_indigena' | 'unidade_conservacao' | 'embargo_ibama'>
}

export async function verificarSobreposicao(
  opts: VerificarSobreposicaoOpts,
): Promise<SobreposicaoResultado> {
  const bbox = calcularBbox(opts.geoJson)
  if (!bbox) {
    return {
      temSobreposicao: false,
      areas: [],
      consultadoEm: new Date().toISOString(),
      fonte: 'mock',
    }
  }

  const cacheKey = `sobreposicao:${bbox.map((n) => n.toFixed(4)).join(',')}:${opts.uf || 'all'}:${(opts.tipos || []).join(',')}`
  const cached = await redis.get(cacheKey).catch(() => null)
  if (cached) {
    try {
      return JSON.parse(cached) as SobreposicaoResultado
    } catch {
      // ignore
    }
  }

  // Query candidatas por uf + tipo
  const where: any = {}
  if (opts.uf) where.uf = opts.uf
  if (opts.tipos && opts.tipos.length > 0) where.tipo = { in: opts.tipos }

  const candidatas = await db.areaProtegida.findMany({ where, take: 5000 })

  const areas: SobreposicaoArea[] = []
  for (const ap of candidatas) {
    const apBbox = (ap.bboxJson as number[] | null) || calcularBbox(ap.geoJson)
    if (!apBbox) continue
    if (!bboxOverlap(bbox, apBbox)) continue
    const pct = bboxOverlapPct(bbox, apBbox)
    if (pct <= 0) continue
    areas.push({
      id: ap.id,
      tipo: ap.tipo,
      nome: ap.nome,
      uf: ap.uf,
      fonte: ap.fonte,
      overlapPct: Number(pct.toFixed(2)),
    })
  }

  const resultado: SobreposicaoResultado = {
    temSobreposicao: areas.length > 0,
    areas,
    consultadoEm: new Date().toISOString(),
    fonte: 'local_db',
  }

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(resultado)).catch(() => {})
  return { ...resultado, cacheMiss: true }
}
