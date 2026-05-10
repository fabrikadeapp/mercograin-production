/**
 * S5 M9 — Adapter MapBiomas Alerta (gratuito).
 *
 * Consulta alertas de desmatamento/degradação para uma área (CAR, bbox ou
 * GeoJSON). API pública: https://plataforma.alerta.mapbiomas.org/api/v2
 *
 * Estratégia ZERO-CUSTO:
 *  - Cache 7 dias em Redis (alertas atualizam semanalmente)
 *  - Tenta fetch real; fallback graceful pra mock se network/credentials falham
 *
 * Mock: usado em dev/CI quando MAPBIOMAS_API_TOKEN não está setado.
 */
import { redis } from '@/lib/redis'

const MAPBIOMAS_API = process.env.MAPBIOMAS_API || 'https://plataforma.alerta.mapbiomas.org/api/v2'
const MAPBIOMAS_TOKEN = process.env.MAPBIOMAS_API_TOKEN
const CACHE_TTL = 60 * 60 * 24 * 7 // 7 dias

export interface MapBiomasAlerta {
  id: number
  data: string
  area_ha: number
  bioma: string
  uf: string
  municipio: string
  classe: 'desmatamento' | 'degradacao' | string
  geometry: any
}

export interface MapBiomasResultado {
  car?: string
  bbox?: number[]
  consultadoEm: string
  totalAlertas: number
  alertas: MapBiomasAlerta[]
  fonte: 'mapbiomas' | 'mock'
  cacheMiss?: boolean
}

export interface ConsultaMapBiomasOpts {
  car?: string
  bbox?: number[]
  geoJson?: any
  desde?: Date
}

function cacheKey(opts: ConsultaMapBiomasOpts): string {
  const key = opts.car || (opts.bbox ? opts.bbox.join(',') : JSON.stringify(opts.geoJson || {}))
  const desde = opts.desde?.toISOString().slice(0, 10) || 'all'
  return `mapbiomas:${key}:${desde}`
}

export async function consultarMapBiomas(opts: ConsultaMapBiomasOpts): Promise<MapBiomasResultado> {
  const key = cacheKey(opts)
  const cached = await redis.get(key).catch(() => null)
  if (cached) {
    try {
      return JSON.parse(cached) as MapBiomasResultado
    } catch {
      // ignora cache corrompido
    }
  }

  const desde = opts.desde || new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000)
  let resultado: MapBiomasResultado

  // Sem token => modo mock graceful
  if (!MAPBIOMAS_TOKEN) {
    resultado = buildMock(opts)
  } else {
    try {
      const resp = await fetch(`${MAPBIOMAS_API}/alerts/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MAPBIOMAS_TOKEN}`,
        },
        body: JSON.stringify({
          aoi: opts.geoJson || (opts.bbox ? bboxToGeoJson(opts.bbox) : null),
          car: opts.car || undefined,
          dateStart: desde.toISOString().slice(0, 10),
          dateEnd: new Date().toISOString().slice(0, 10),
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (!resp.ok) {
        console.warn(`[MapBiomas] HTTP ${resp.status}, usando mock`)
        resultado = buildMock(opts)
      } else {
        const json = (await resp.json()) as any
        const alertas: MapBiomasAlerta[] = (json?.alerts || json?.data || []).map((a: any) => ({
          id: a.id,
          data: a.date || a.data,
          area_ha: a.area_ha || a.areaHa || 0,
          bioma: a.bioma || a.biome || '',
          uf: a.uf || a.state || '',
          municipio: a.municipio || a.city || '',
          classe: a.classe || a.class || 'desmatamento',
          geometry: a.geometry || null,
        }))
        resultado = {
          car: opts.car,
          bbox: opts.bbox,
          consultadoEm: new Date().toISOString(),
          totalAlertas: alertas.length,
          alertas,
          fonte: 'mapbiomas',
        }
      }
    } catch (err) {
      console.warn('[MapBiomas] Falha fetch, usando mock:', (err as Error).message)
      resultado = buildMock(opts)
    }
  }

  await redis.setex(key, CACHE_TTL, JSON.stringify(resultado)).catch(() => {})
  return { ...resultado, cacheMiss: true }
}

function buildMock(opts: ConsultaMapBiomasOpts): MapBiomasResultado {
  return {
    car: opts.car,
    bbox: opts.bbox,
    consultadoEm: new Date().toISOString(),
    totalAlertas: 0,
    alertas: [],
    fonte: 'mock',
  }
}

function bboxToGeoJson(bbox: number[]): any {
  const [minLng, minLat, maxLng, maxLat] = bbox
  return {
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
      [minLng, minLat],
    ]],
  }
}
