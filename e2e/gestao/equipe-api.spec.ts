import { test, expect } from '@playwright/test'

test.describe('Gestão · Equipe API', () => {
  test('GET /api/workspace/members sem auth → 401', async ({ request }) => {
    const res = await request.get('/api/workspace/members')
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/workspace/members sem auth → 401', async ({ request }) => {
    const res = await request.post('/api/workspace/members', {
      data: { email: 'x@y.co', role: 'member', areasPermitidas: ['mesa'] },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/equipe/abc/transferir-carteira sem auth → 401', async ({ request }) => {
    const res = await request.post('/api/equipe/abc/transferir-carteira', {
      data: { destinatarioId: 'def' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('GET /api/workspace/members/accept aceita schema', async ({ request }) => {
    const res = await request.post('/api/workspace/members/accept', {
      data: { token: 'short' },
    })
    expect([400, 404]).toContain(res.status())
  })

  test('GET /gestao/equipe sem auth → redirect', async ({ page }) => {
    const res = await page.goto('/gestao/equipe')
    // Middleware redireciona pra login
    expect(page.url()).toContain('/auth/login')
  })
})
