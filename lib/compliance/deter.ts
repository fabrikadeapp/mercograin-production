/**
 * S5 M9 — Adapter INPE DETER (stub).
 *
 * INPE DETER fornece alertas de desmatamento via TerraBrasilis (FTP/CSV).
 * Não há REST oficial pública, então este adapter é stub: retorna lista vazia
 * com fonte='mock'. Estrutura pronta pra implementação futura (scraping ou
 * mirror local de CSV).
 */
import { redis } from '@/lib/redis'

const CACHE_TTL = 60 * 60 * 24 * 7

export interface DeterAlerta {
  id: number
  data: string
  area_ha: number
  uf: string
  municipio: string
  classe: string
  geometry: any
}

export interface DeterResultado {
  bbox?: number[]
  consultadoEm: string
  totalAlertas: number
  alertas: DeterAlerta[]
  fonte: 'inpe_deter' | 'mock'
  cacheMiss?: boolean
}

export async function consultarDETER(bbox?: number[], desde?: Date): Promise<DeterResultado> {
  const key = `deter:${bbox?.join(',') || 'all'}:${desde?.toISOString().slice(0, 10) || 'all'}`
  const cached = await redis.get(key).catch(() => null)
  if (cached) {
    try {
      return JSON.parse(cached) as DeterResultado
    } catch {
      // ignore
    }
  }

  // TODO: implementar fetch real do TerraBrasilis quando justificar
  const resultado: DeterResultado = {
    bbox,
    consultadoEm: new Date().toISOString(),
    totalAlertas: 0,
    alertas: [],
    fonte: 'mock',
  }

  await redis.setex(key, CACHE_TTL, JSON.stringify(resultado)).catch(() => {})
  return { ...resultado, cacheMiss: true }
}
