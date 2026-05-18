import { test, expect } from '@playwright/test'

test.describe('Mesa · Propostas API (sem auth)', () => {
  test('GET /api/propostas sem cookie → 401', async ({ request }) => {
    const res = await request.get('/api/propostas')
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/propostas sem cookie → 401', async ({ request }) => {
    const res = await request.post('/api/propostas', {
      data: { clienteId: 'x', tipo: 'venda', valor: 1, graos: [], validadeEm: '2026-12-31' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('GET /api/propostas/abc/pdf sem cookie → 401/404', async ({ request }) => {
    const res = await request.get('/api/propostas/abc/pdf')
    expect([401, 403, 404]).toContain(res.status())
  })

  test('POST /api/propostas/abc/autorizar sem cookie → 401', async ({ request }) => {
    const res = await request.post('/api/propostas/abc/autorizar', {
      data: { acao: 'aprovar' },
    })
    expect([401, 403, 404]).toContain(res.status())
  })
})

test.describe('Mesa · Contratos API (sem auth)', () => {
  test('GET /api/contratos sem cookie → 401', async ({ request }) => {
    const res = await request.get('/api/contratos')
    expect([401, 403]).toContain(res.status())
  })

  test('GET /api/contratos/abc/pdf sem cookie → 401/404', async ({ request }) => {
    const res = await request.get('/api/contratos/abc/pdf')
    expect([401, 403, 404]).toContain(res.status())
  })
})
