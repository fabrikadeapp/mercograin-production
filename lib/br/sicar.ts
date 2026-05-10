/**
 * S4 M1 — Adapter SICAR (Sistema Nacional de Cadastro Ambiental Rural).
 *
 * O SICAR público (https://www.car.gov.br/publico/imoveis/index) é a base
 * oficial dos CARs, porém a consulta pública requer CAPTCHA e não expõe
 * JSON. Não há API REST oficial gratuita.
 *
 * Estratégia ZERO-CUSTO (MVP):
 *   1) Validar formato local (lib/br/car.ts)
 *   2) Cache 30 dias (CAR muda raramente)
 *   3) Retornar resultado com `fonte: 'mock'` indicando que não houve
 *      consulta SICAR real — apenas validação de formato.
 *
 * Quando provider pago for plugado (ex.: Geoambi, Agrotools, Geoflorestas),
 * substituir `fetchSicarReal()` por implementação real. A interface se mantém.
 */
import { isValidCarFormat, parseCar } from './car'
import { redis } from '@/lib/redis'

export type SicarStatus =
  | 'ativo'
  | 'pendente'
  | 'cancelado'
  | 'analise'
  | 'invalido'
  | 'desconhecido'

export interface SicarResultado {
  car: string
  status: SicarStatus
  uf: string
  municipio: string
  areaTotalHa?: number
  areaReservaLegal?: number
  areaApp?: number
  consultadoEm: string
  fonte: 'sicar' | 'mock'
  raw?: any
}

const CACHE_TTL_SECONDS = 30 * 86400 // 30 dias

async function cacheGet(key: string): Promise<SicarResultado | null> {
  try {
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as SicarResultado
  } catch {
    return null
  }
}

async function cacheSet(key: string, value: SicarResultado): Promise<void> {
  try {
    await redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(value))
  } catch {
    // cache best-effort
  }
}

/**
 * Consulta SICAR para um CAR específico.
 *
 * @returns null se formato inválido. Caso contrário, sempre retorna
 *          resultado (`fonte: 'mock'` indica ausência de consulta real).
 */
export async function consultarCAR(car: string): Promise<SicarResultado | null> {
  if (!isValidCarFormat(car)) return null

  const normalized = car.replace(/\s/g, '').toUpperCase()
  const cacheKey = `car:${normalized}`

  const cached = await cacheGet(cacheKey)
  if (cached) return cached

  const parts = parseCar(normalized)!

  // TODO: integrar provider pago. Por enquanto, retorna 'desconhecido'.
  const result: SicarResultado = {
    car: normalized,
    status: 'desconhecido',
    uf: parts.uf,
    municipio: parts.municipio,
    consultadoEm: new Date().toISOString(),
    fonte: 'mock',
  }

  await cacheSet(cacheKey, result)
  return result
}
