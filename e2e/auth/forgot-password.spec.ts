import { test, expect } from '@playwright/test'

test.describe('Auth · Forgot Password', () => {
  test('GET /auth/forgot-password renderiza formulário', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('POST /api/auth/forgot-password aceita email inexistente sem vazar', async ({ request }) => {
    // Boa prática: não revelar se email existe
    const res = await request.post('/api/auth/forgot-password', {
      data: { email: `nunca-existiu-${Date.now()}@teste.local` },
    })
    // Deve retornar 200 (genérico) ou aceitar
    expect([200, 202, 204]).toContain(res.status())
  })

  test('POST /api/auth/forgot-password rejeita email inválido', async ({ request }) => {
    const res = await request.post('/api/auth/forgot-password', {
      data: { email: 'not-an-email' },
    })
    expect([400, 422]).toContain(res.status())
  })
})
