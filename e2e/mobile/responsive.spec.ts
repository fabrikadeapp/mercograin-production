import { test, expect } from '@playwright/test'

// Usa Chrome em viewport iPhone 13 (sem precisar WebKit instalado)
test.use({
  viewport: { width: 390, height: 844 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
})

/**
 * Verifica que rotas principais não têm scroll horizontal em viewport mobile.
 * Não exige auth — testa só renderização básica + redirects.
 */

const PAGES = [
  '/',
  '/precos',
  '/sobre',
  '/auth/login',
  '/auth/signup',
  '/status',
]

test.describe('Mobile responsive (iPhone 13)', () => {
  for (const path of PAGES) {
    test(`${path} sem overflow horizontal`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')

      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      )
      const clientWidth = await page.evaluate(
        () => document.documentElement.clientWidth,
      )

      // Tolera 2px de margem de erro
      expect(scrollWidth, `${path}: overflow ${scrollWidth - clientWidth}px`).toBeLessThanOrEqual(
        clientWidth + 2,
      )
    })
  }
})
