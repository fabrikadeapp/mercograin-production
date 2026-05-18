import { test, expect } from '@playwright/test'

test.describe('Financeiro · Comissões API', () => {
  test('GET /api/comissao/apuradas sem auth → 401', async ({ request }) => {
    const res = await request.get('/api/comissao/apuradas')
    expect([401, 403]).toContain(res.status())
  })

  test('PATCH /api/comissao/apuradas/abc sem auth → 401', async ({ request }) => {
    const res = await request.patch('/api/comissao/apuradas/abc', {
      data: { status: 'paga' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/comissao/apuradas/abc/cobrar sem auth → 401', async ({ request }) => {
    const res = await request.post('/api/comissao/apuradas/abc/cobrar', {
      data: { destinatarioTipo: 'corretor' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('GET /financeiro/comissoes sem auth → redirect', async ({ page }) => {
    await page.goto('/financeiro/comissoes')
    expect(page.url()).toContain('/auth/login')
  })
})
