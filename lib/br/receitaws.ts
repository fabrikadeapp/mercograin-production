/**
 * Cliente para consulta pública de CNPJ.
 *
 * Estratégia:
 *   1) BrasilAPI (sem rate limit, dados completos)
 *   2) ReceitaWS (3 req/min — fallback)
 *
 * Resultado é cacheado em memória por 24h por CNPJ.
 * Dados de cadastro de PJ são praticamente imutáveis no curto prazo,
 * então o cache reduz drasticamente chamadas externas.
 */

export interface CnpjData {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  email: string | null
  telefone: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  municipio: string | null
  uf: string | null
  situacao: string | null
  capital: number | null
  dataAbertura: string | null
  source: 'brasilapi' | 'receitaws'
}

const cache = new Map<string, { data: CnpjData; expires: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24h

export async function consultarCnpj(cnpj: string): Promise<CnpjData | null> {
  const clean = cnpj.replace(/\D/g, '')
  if (clean.length !== 14) return null

  const cached = cache.get(clean)
  if (cached && cached.expires > Date.now()) return cached.data

  // 1. BrasilAPI (sem rate limit)
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    })
    if (r.ok) {
      const j = await r.json()
      const data: CnpjData = {
        cnpj: clean,
        razaoSocial: j.razao_social || '',
        nomeFantasia: j.nome_fantasia || null,
        email: j.email || null,
        telefone: j.ddd_telefone_1 || null,
        cep: j.cep || null,
        logradouro: j.logradouro || null,
        numero: j.numero || null,
        complemento: j.complemento || null,
        bairro: j.bairro || null,
        municipio: j.municipio || null,
        uf: j.uf || null,
        situacao: j.descricao_situacao_cadastral || null,
        capital: typeof j.capital_social === 'number' ? j.capital_social : null,
        dataAbertura: j.data_inicio_atividade || null,
        source: 'brasilapi',
      }
      cache.set(clean, { data, expires: Date.now() + CACHE_TTL })
      return data
    }
  } catch (e) {
    console.warn('[receitaws] brasilapi failed, trying receitaws', e)
  }

  // 2. ReceitaWS fallback (3/min)
  try {
    const r = await fetch(`https://receitaws.com.br/v1/cnpj/${clean}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return null
    const j = await r.json()
    if (j.status === 'ERROR') return null

    const data: CnpjData = {
      cnpj: clean,
      razaoSocial: j.nome || '',
      nomeFantasia: j.fantasia || null,
      email: j.email || null,
      telefone: j.telefone || null,
      cep: j.cep || null,
      logradouro: j.logradouro || null,
      numero: j.numero || null,
      complemento: j.complemento || null,
      bairro: j.bairro || null,
      municipio: j.municipio || null,
      uf: j.uf || null,
      situacao: j.situacao || null,
      capital:
        typeof j.capital_social === 'string'
          ? parseFloat(j.capital_social)
          : null,
      dataAbertura: j.abertura || null,
      source: 'receitaws',
    }
    cache.set(clean, { data, expires: Date.now() + CACHE_TTL })
    return data
  } catch (e) {
    console.error('[receitaws] both providers failed', e)
    return null
  }
}
