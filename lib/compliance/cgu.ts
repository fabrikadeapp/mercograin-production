/**
 * S4 M1 — Adapter Portal da Transparência CGU.
 *
 * API oficial gratuita: https://api.portaldatransparencia.gov.br/
 *
 * Exige token (gratuito) obtido em https://api.portaldatransparencia.gov.br/swagger-ui.html
 * Sem token: retorna resultado vazio com `fonte: 'mock'`.
 *
 * Endpoints consultados:
 *   - CEIS  — Cadastro de Empresas Inidôneas e Suspensas
 *   - CNEP  — Cadastro Nacional de Empresas Punidas
 *   - CEPIM — Cadastro de Entidades Privadas Sem Fins Lucrativos Impedidas
 */
import { redis } from '@/lib/redis'

const CGU_BASE = 'https://api.portaldatransparencia.gov.br/api-de-dados'
const CGU_TOKEN = process.env.CGU_API_TOKEN
const TIMEOUT_MS = 10_000
const CACHE_TTL_SECONDS = 24 * 3600 // 24h

export interface CguRegistro {
  origem: 'ceis' | 'cnep' | 'cepim'
  raw: any
}

export interface CguResultado {
  cnpj: string
  consultadoEm: string
  ceis: { temRegistro: boolean; registros: any[] }
  cnep: { temRegistro: boolean; registros: any[] }
  cepim: { temRegistro: boolean; registros: any[] }
  fonte: 'cgu' | 'mock'
  erros?: string[]
}

function emptyResultado(cnpj: string, fonte: CguResultado['fonte'], erros?: string[]): CguResultado {
  return {
    cnpj,
    consultadoEm: new Date().toISOString(),
    ceis: { temRegistro: false, registros: [] },
    cnep: { temRegistro: false, registros: [] },
    cepim: { temRegistro: false, registros: [] },
    fonte,
    erros,
  }
}

async function fetchJson(url: string, signal: AbortSignal): Promise<any[]> {
  const res = await fetch(url, {
    headers: {
      'chave-api-dados': CGU_TOKEN!,
      Accept: 'application/json',
    },
    signal,
  })
  if (!res.ok) {
    throw new Error(`CGU ${res.status}: ${url}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

/**
 * Consulta CGU para um CNPJ. Roda os 3 endpoints em paralelo.
 * Limpa formatação automaticamente.
 */
export async function consultarSancoesCGU(cnpj: string): Promise<CguResultado> {
  const clean = cnpj.replace(/\D/g, '')
  if (clean.length !== 14) {
    return emptyResultado(clean, 'mock', ['cnpj_invalido'])
  }

  if (!CGU_TOKEN) {
    return emptyResultado(clean, 'mock')
  }

  // Cache
  const cacheKey = `cgu:${clean}`
  try {
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached) as CguResultado
  } catch {
    // best-effort
  }

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const erros: string[] = []

  try {
    const [ceis, cnep, cepim] = await Promise.allSettled([
      fetchJson(`${CGU_BASE}/ceis?cnpjSancionado=${clean}&pagina=1`, ctrl.signal),
      fetchJson(`${CGU_BASE}/cnep?cnpjSancionado=${clean}&pagina=1`, ctrl.signal),
      fetchJson(`${CGU_BASE}/cepim?cnpj=${clean}&pagina=1`, ctrl.signal),
    ])

    const ceisData = ceis.status === 'fulfilled' ? ceis.value : (erros.push('ceis_falhou'), [])
    const cnepData = cnep.status === 'fulfilled' ? cnep.value : (erros.push('cnep_falhou'), [])
    const cepimData = cepim.status === 'fulfilled' ? cepim.value : (erros.push('cepim_falhou'), [])

    const result: CguResultado = {
      cnpj: clean,
      consultadoEm: new Date().toISOString(),
      ceis: { temRegistro: ceisData.length > 0, registros: ceisData },
      cnep: { temRegistro: cnepData.length > 0, registros: cnepData },
      cepim: { temRegistro: cepimData.length > 0, registros: cepimData },
      fonte: 'cgu',
      erros: erros.length ? erros : undefined,
    }

    try {
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result))
    } catch {
      // best-effort
    }

    return result
  } catch (err: any) {
    return emptyResultado(clean, 'mock', [err?.message || 'erro_desconhecido'])
  } finally {
    clearTimeout(timeout)
  }
}
