import { test, expect } from '@playwright/test'

/**
 * Smoke API: garante que endpoints autenticados retornam 401 (não 500)
 * quando chamados sem cookie. Detecta endpoints que crasham antes da
 * checagem de auth.
 */
const PROTECTED_ENDPOINTS = [
  '/api/inbox',
  '/api/clientes',
  '/api/propostas',
  '/api/contratos',
  '/api/bhgrain/precos',
  '/api/bhgrain/health',
  '/api/bhgrain/insight',
  '/api/comissao/apuradas',
  '/api/admin/crons',
  '/api/equipe/abc/performance',
]

test.describe('Smoke — endpoints retornam 401 sem auth', () => {
  for (const url of PROTECTED_ENDPOINTS) {
    test(`GET ${url}`, async ({ request }) => {
      const res = await request.get(url)
      // Aceitamos 401, 403, ou 404 (no caso de ids inválidos com guard early)
      expect([401, 403, 404]).toContain(res.status())
    })
  }
})
