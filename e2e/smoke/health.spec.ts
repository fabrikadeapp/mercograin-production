import { test, expect } from '@playwright/test'

test.describe('Smoke — Endpoints públicos', () => {
  test('GET /api/health retorna 200 com ok=true', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  test('GET /status renderiza página de health', async ({ page }) => {
    const res = await page.goto('/status')
    expect(res?.status()).toBeLessThan(400)
    await expect(page.getByText(/Tudo operacional|Atenção/)).toBeVisible()
  })

  test('GET / (landing) responde sub-2s', async ({ page }) => {
    const start = Date.now()
    const res = await page.goto('/')
    const elapsed = Date.now() - start
    expect(res?.status()).toBe(200)
    expect(elapsed).toBeLessThan(2000)
  })

  test('GET /precos renderiza tabela de planos', async ({ page }) => {
    const res = await page.goto('/precos')
    expect(res?.status()).toBe(200)
    // Espera ver algum elemento característico
    await expect(page.locator('body')).toContainText(/preço|trial|plano/i)
  })

  test('GET /auth/login renderiza form', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
  })
})
