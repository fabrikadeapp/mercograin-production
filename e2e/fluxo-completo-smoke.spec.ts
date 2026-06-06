/**
 * Smoke E2E completo — captura screenshots da jornada principal em produção.
 * Run: BASE_URL=https://www.profitsync.ia.br npx playwright test fluxo-completo-smoke --reporter=line
 *
 * Cobre:
 *  1. Landing pública
 *  2. Dropdown "Entrar" → portal do produtor
 *  3. Login do produtor
 *  4. Home do portal (timeline)
 *  5. Solicitar cotação (form + envio)
 *  6. Página de propostas
 *  7. Página de contratos (assinados)
 *  8. Página de meu perfil
 *  9. Chat com a corretora (envia mensagem)
 *
 * Screenshots salvos em docs/smoke-screenshots/<NN>-<nome>.png
 */
import { test, expect, type Page } from '@playwright/test'
import path from 'path'

const SHOT_DIR = path.join(process.cwd(), 'docs/smoke-screenshots')
const EMAIL = 'aero.gus@hotmail.com'
const SENHA = 'ReiDoGado2026!'

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SHOT_DIR, `${name}.png`),
    fullPage: true,
  })
}

test.describe.serial('Smoke fluxo completo BH Grain', () => {
  test('1. landing pública', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await shot(page, '01-landing')
  })

  test('2. dropdown Entrar', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Clica em "Entrar"
    const entrar = page.getByRole('button', { name: /entrar/i }).first()
    await entrar.click({ timeout: 5000 }).catch(() => undefined)
    await page.waitForTimeout(500)
    await shot(page, '02-dropdown-entrar')
  })

  test('3. portal — tela de login do produtor', async ({ page }) => {
    await page.goto('/portal')
    await page.waitForLoadState('networkidle')
    await shot(page, '03-portal-login')
  })

  test('4. login produtor + home', async ({ page }) => {
    await page.goto('/portal')
    await page.waitForLoadState('networkidle')
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(SENHA)
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.getByRole('button', { name: /entrar/i }).click(),
    ])
    await page.waitForTimeout(2000)
    await shot(page, '04-portal-home-timeline')
  })

  test('5. solicitar cotação (form vazio)', async ({ page }) => {
    await login(page)
    await page.goto('/portal/mercograin/solicitar-cotacao')
    await page.waitForLoadState('networkidle')
    await shot(page, '05-solicitar-cotacao-form')
  })

  test('6. solicitar cotação — preenche e envia', async ({ page }) => {
    await login(page)
    await page.goto('/portal/mercograin/solicitar-cotacao')
    await page.waitForLoadState('networkidle')
    // Preenche quantidade
    const qtd = page.locator('input[type="number"]').first()
    await qtd.fill('750')
    await page.waitForTimeout(300)
    await shot(page, '06-solicitar-cotacao-preenchido')

    // Envia
    await page.getByRole('button', { name: /enviar solicitação/i }).click()
    await page.waitForTimeout(3000)
    await shot(page, '07-solicitacao-enviada')
  })

  test('7. propostas do portal', async ({ page }) => {
    await login(page)
    await page.goto('/portal/mercograin/propostas')
    await page.waitForLoadState('networkidle')
    await shot(page, '08-portal-propostas')
  })

  test('8. contratos do portal', async ({ page }) => {
    await login(page)
    await page.goto('/portal/mercograin/contratos')
    await page.waitForLoadState('networkidle')
    await shot(page, '09-portal-contratos')
  })

  test('9. boletos do portal', async ({ page }) => {
    await login(page)
    await page.goto('/portal/mercograin/recebiveis')
    await page.waitForLoadState('networkidle')
    await shot(page, '10-portal-boletos')
  })

  test('10. perfil do produtor', async ({ page }) => {
    await login(page)
    await page.goto('/portal/mercograin/perfil')
    await page.waitForLoadState('networkidle')
    await shot(page, '11-portal-perfil')
  })

  test('11. chat — envia mensagem', async ({ page }) => {
    await login(page)
    await page.goto('/portal/mercograin/chat')
    await page.waitForLoadState('networkidle')
    await shot(page, '12-portal-chat-antes')

    const input = page.locator('input[placeholder*="Digite"]').first()
    if (await input.isVisible().catch(() => false)) {
      await input.fill('Teste de mensagem do produtor para a corretora — smoke E2E')
      await page.getByRole('button', { name: /enviar/i }).click()
      await page.waitForTimeout(2000)
      await shot(page, '13-portal-chat-enviada')
    }
  })

  test('12. tema escuro do portal', async ({ page }) => {
    await login(page)
    await page.goto('/portal/mercograin')
    await page.waitForLoadState('networkidle')
    const toggle = page.getByRole('button', { name: /escuro|claro/i }).first()
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click()
      await page.waitForTimeout(800)
      await shot(page, '14-portal-tema-escuro')
    }
  })
})

async function login(page: Page) {
  await page.goto('/portal')
  await page.waitForLoadState('networkidle')
  // Se já estiver logado, não precisa
  if (page.url().includes('/portal/mercograin')) return
  const emailInput = page.locator('input[type="email"]')
  if (!(await emailInput.isVisible().catch(() => false))) return
  await emailInput.fill(EMAIL)
  await page.locator('input[type="password"]').fill(SENHA)
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.getByRole('button', { name: /entrar/i }).click(),
  ])
  await page.waitForTimeout(1500)
}
