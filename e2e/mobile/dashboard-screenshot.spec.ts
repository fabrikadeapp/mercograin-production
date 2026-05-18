import { test, expect } from '@playwright/test'

test.use({
  viewport: { width: 390, height: 844 },
})

/**
 * Mede overflow horizontal nas páginas autenticadas (redirect pra login).
 * Não testa conteúdo logado — testa que a página de login renderiza bem
 * e que se houver overflow, a gente detecta.
 */
test('Login page sem overflow em mobile', async ({ page }) => {
  await page.goto('/auth/login')
  await page.waitForLoadState('domcontentloaded')

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
  }))

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2)
})

test('Status page sem overflow em mobile', async ({ page }) => {
  await page.goto('/status')
  await page.waitForLoadState('domcontentloaded')

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(2)
})

test('Precos page legível em mobile', async ({ page }) => {
  await page.goto('/precos')
  await page.waitForLoadState('domcontentloaded')

  // Verifica que tem botão/link visível pra signup/checkout
  const cta = page.locator('a, button').filter({ hasText: /trial|grátis|começar|criar|teste/i }).first()
  await expect(cta).toBeVisible()
})
