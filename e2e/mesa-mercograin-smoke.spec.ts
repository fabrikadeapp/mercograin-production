/**
 * Smoke da mesa de operações da corretora.
 * Run: BASE_URL=https://www.profitsync.ia.br npx playwright test mesa-mercograin --reporter=line
 */
import { test, type Page } from '@playwright/test'
import path from 'path'

const SHOT_DIR = path.join(process.cwd(), 'docs/smoke-screenshots')
const EMAIL = 'admin@mercograin.com'
const SENHA = 'SmokeAdmin2026!'

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SHOT_DIR, `${name}.png`),
    fullPage: true,
  })
}

async function login(page: Page) {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
  if (page.url().includes('/dashboard') || page.url().includes('/bhgrain')) return
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(SENHA)
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.getByRole('button', { name: /entrar|login|acessar/i }).click(),
  ])
  await page.waitForTimeout(3000)
}

test.describe.serial('Smoke mesa Mercograin', () => {
  test('20. login da corretora', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('domcontentloaded')
    await shot(page, '20-corretora-login')
  })

  test('21. dashboard com 4 cards de fluxo', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(4000)
    await shot(page, '21-dashboard-4-cards')
  })

  test('22. dropdown Mesa', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
    const mesa = page.getByRole('button', { name: /^Mesa/ }).first()
    if (await mesa.isVisible().catch(() => false)) {
      await mesa.hover()
      await page.waitForTimeout(500)
      await shot(page, '22-dropdown-mesa')
    }
  })

  test('23. dropdown Financeiro', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
    const fin = page.getByRole('button', { name: /^Financeiro/ }).first()
    if (await fin.isVisible().catch(() => false)) {
      await fin.hover()
      await page.waitForTimeout(500)
      await shot(page, '23-dropdown-financeiro')
    }
  })

  test('24. dropdown Gestão', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
    const ges = page.getByRole('button', { name: /^Gestão/ }).first()
    if (await ges.isVisible().catch(() => false)) {
      await ges.hover()
      await page.waitForTimeout(500)
      await shot(page, '24-dropdown-gestao')
    }
  })

  test('25. página de solicitações', async ({ page }) => {
    await login(page)
    await page.goto('/solicitacoes')
    await page.waitForLoadState('domcontentloaded')
    await shot(page, '25-solicitacoes-mesa')
  })

  test('26. propostas da mesa', async ({ page }) => {
    await login(page)
    await page.goto('/propostas')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    await shot(page, '26-propostas-mesa')
  })

  test('27. contratos da mesa', async ({ page }) => {
    await login(page)
    await page.goto('/contratos')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    await shot(page, '27-contratos-mesa')
  })

  test('28. clientes da mesa', async ({ page }) => {
    await login(page)
    await page.goto('/clientes')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    await shot(page, '28-clientes-mesa')
  })

  test('29. boletos (financeiro)', async ({ page }) => {
    await login(page)
    await page.goto('/boletos')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    await shot(page, '29-boletos-mesa')
  })

  test('30. fluxo de caixa', async ({ page }) => {
    await login(page)
    await page.goto('/fluxo-de-caixa')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    await shot(page, '30-fluxo-de-caixa')
  })

  test('31. marca & logo', async ({ page }) => {
    await login(page)
    await page.goto('/configuracoes/marca')
    await page.waitForLoadState('domcontentloaded')
    await shot(page, '31-configuracoes-marca')
  })

  test('32. meu perfil (staff)', async ({ page }) => {
    await login(page)
    await page.goto('/perfil')
    await page.waitForLoadState('domcontentloaded')
    await shot(page, '32-perfil-staff')
  })
})
