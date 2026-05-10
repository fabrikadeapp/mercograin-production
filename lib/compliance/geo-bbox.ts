/**
 * S5 M9 — Helpers geométricos puros (sem IO). Extraído para permitir testes
 * unitários isolados (sem importar Redis/DB).
 */

/**
 * Calcula bbox de um GeoJSON Polygon/MultiPolygon/Feature.
 * Retorna [minLng, minLat, maxLng, maxLat] ou null se inválido.
 */
export function calcularBbox(geoJson: any): number[] | null {
  if (!geoJson) return null
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity
  let count = 0

  function walk(coords: any) {
    if (typeof coords?.[0] === 'number' && typeof coords?.[1] === 'number') {
      const [lng, lat] = coords
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        minLng = Math.min(minLng, lng)
        minLat = Math.min(minLat, lat)
        maxLng = Math.max(maxLng, lng)
        maxLat = Math.max(maxLat, lat)
        count++
      }
      return
    }
    if (Array.isArray(coords)) coords.forEach(walk)
  }

  const geom = geoJson.type === 'Feature' ? geoJson.geometry : geoJson
  if (!geom?.coordinates) return null
  walk(geom.coordinates)
  if (count === 0) return null
  return [minLng, minLat, maxLng, maxLat]
}

/** True se os bboxes sobrepõem. */
export function bboxOverlap(a: number[], b: number[]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}

/** % aproximada de sobreposição (área intersect / área a). */
export function bboxOverlapPct(a: number[], b: number[]): number {
  const iMinLng = Math.max(a[0], b[0])
  const iMinLat = Math.max(a[1], b[1])
  const iMaxLng = Math.min(a[2], b[2])
  const iMaxLat = Math.min(a[3], b[3])
  if (iMaxLng <= iMinLng || iMaxLat <= iMinLat) return 0
  const areaA = (a[2] - a[0]) * (a[3] - a[1])
  if (areaA <= 0) return 0
  const areaI = (iMaxLng - iMinLng) * (iMaxLat - iMinLat)
  return Math.min(1, areaI / areaA) * 100
}
