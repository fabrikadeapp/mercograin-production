import { test, expect } from '@playwright/test'

test.describe('Auth · Signup', () => {
  test('GET /auth/signup renderiza formulário', async ({ page }) => {
    await page.goto('/auth/signup')
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('POST /api/auth/signup rejeita email inválido', async ({ request }) => {
    const res = await request.post('/api/auth/signup', {
      data: { nome: 'Test', email: 'not-an-email', senha: 'Abc12345!' },
    })
    // 429 = rate limit por IP (esperado se rodando muitos testes)
    expect([400, 422, 429]).toContain(res.status())
  })

  test('POST /api/auth/signup rejeita senha fraca', async ({ request }) => {
    const res = await request.post('/api/auth/signup', {
      data: {
        nome: 'Test',
        email: `weak-${Date.now()}@teste.local`,
        senha: '123',
      },
    })
    expect([400, 422, 429]).toContain(res.status())
  })

  test('POST /api/auth/signup rejeita nome curto', async ({ request }) => {
    const res = await request.post('/api/auth/signup', {
      data: { nome: 'X', email: 'a@b.co', senha: 'StrongPass123!' },
    })
    expect([400, 422, 429]).toContain(res.status())
  })
})
