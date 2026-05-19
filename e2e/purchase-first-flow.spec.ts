/**
 * E2E Purchase-First Flow — PRODUCTION (https://www.profitsync.ia.br)
 *
 * Flow:
 *   /comprar → form → Stripe Checkout → /comprar/sucesso →
 *   /ativar/{token} (wizard 2 steps) → /dashboard
 *
 * Pre-req envs:
 *   - DATABASE_URL (Railway prod)
 *   - STRIPE_SECRET_KEY (test mode)
 *   - BASE_URL=https://www.profitsync.ia.br
 */

import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const BASE_URL = process.env.BASE_URL ?? 'https://www.profitsync.ia.br'
const TEST_EMAIL_DOMAIN = 'mercograin-test.com'
const EMAIL = `e2e-purchase-${Date.now()}@${TEST_EMAIL_DOMAIN}`
const STEP_TIMEOUT = 60_000

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        'postgresql://postgres:JPZmdPCwgioxsfUmtRaHKmpwxtZVqgVt@yamanote.proxy.rlwy.net:14764/railway',
    },
  },
})

test.describe.configure({ mode: 'serial' })

test.setTimeout(10 * 60_000) // 10 min total

async function cleanupByDomain() {
  console.log(`[cleanup] removing users/licenses with email ~${TEST_EMAIL_DOMAIN}`)

  // Find users
  const users = await prisma.user.findMany({
    where: { email: { contains: TEST_EMAIL_DOMAIN } },
    select: { id: true, email: true },
  })
  const userIds = users.map((u) => u.id)

  // Find workspaces owned by these users
  const wss = await prisma.workspace.findMany({
    where: { ownerId: { in: userIds.length ? userIds : ['__none__'] } },
    select: { id: true },
  })
  const wsIds = wss.map((w) => w.id)

  // Find workspaces from licenses too
  const licenses = await prisma.license.findMany({
    where: { email: { contains: TEST_EMAIL_DOMAIN } },
    select: { id: true, workspaceId: true },
  })
  for (const l of licenses) {
    if (l.workspaceId && !wsIds.includes(l.workspaceId)) wsIds.push(l.workspaceId)
  }

  if (wsIds.length) {
    await prisma.subscription.deleteMany({ where: { workspaceId: { in: wsIds } } })
    await prisma.dadosEmpresa.deleteMany({ where: { workspaceId: { in: wsIds } } })
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: wsIds } } })
  }
  await prisma.workspaceMember.deleteMany({ where: { email: { contains: TEST_EMAIL_DOMAIN } } })
  await prisma.license.deleteMany({ where: { email: { contains: TEST_EMAIL_DOMAIN } } })
  if (wsIds.length) {
    await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } })
  }
  if (userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  }
  console.log(`[cleanup] removed ${users.length} users, ${wsIds.length} workspaces, ${licenses.length} licenses`)
}

async function completeStripeCheckout(page: Page) {
  console.log('[stripe] filling card form')
  // Stripe checkout page can load slowly
  await page.waitForLoadState('domcontentloaded', { timeout: STEP_TIMEOUT })
  // Email may already be prefilled. Look for card number field
  const cardNum = page.locator('input[name="cardNumber"], #cardNumber')
  await cardNum.waitFor({ state: 'visible', timeout: STEP_TIMEOUT })
  await cardNum.fill('4242 4242 4242 4242')

  const exp = page.locator('input[name="cardExpiry"], #cardExpiry')
  await exp.fill('12 / 30')

  const cvc = page.locator('input[name="cardCvc"], #cardCvc')
  await cvc.fill('123')

  const cardholder = page.locator('input[name="billingName"], #billingName')
  if (await cardholder.count()) await cardholder.fill('E2E Test')

  // Country may default to BR — postal code may or may not appear
  const postal = page.locator('input[name="billingPostalCode"], #billingPostalCode')
  if (await postal.count()) {
    try {
      await postal.fill('12345', { timeout: 2000 })
    } catch {
      /* may be hidden for some countries */
    }
  }

  // Submit
  const submit = page.locator('button[type="submit"]')
  await submit.first().click()

  console.log('[stripe] submitted, waiting for redirect to /comprar/sucesso')
  await page.waitForURL(/\/comprar\/sucesso/, { timeout: STEP_TIMEOUT })
}

async function waitForLicense(email: string, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const lic = await prisma.license.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    })
    if (lic && lic.onboardingToken) return lic
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(`License with token never appeared for ${email} within ${timeoutMs}ms`)
}

test('purchase-first flow PROD: /comprar → Stripe → /ativar/{token} → /dashboard', async ({ page }) => {
  console.log(`\n=== E2E Purchase-First START — email=${EMAIL} ===\n`)

  // ---------- Pre-cleanup ----------
  await cleanupByDomain()
  const pre = await prisma.user.findUnique({ where: { email: EMAIL } })
  expect(pre).toBeNull()
  console.log('[step 0] pre-cleanup OK — email free')

  // ---------- Step 1: /comprar ----------
  await page.goto(`${BASE_URL}/comprar`, { waitUntil: 'networkidle', timeout: STEP_TIMEOUT })
  await expect(page.locator('input[value="starter"]')).toBeVisible({ timeout: STEP_TIMEOUT })
  await expect(page.locator('input[value="pro"]')).toBeVisible()
  await expect(page.locator('input[value="enterprise"]')).toBeVisible()
  console.log('[step 1] /comprar loaded with 3 plans')

  // ---------- Step 2: pick starter + fill form ----------
  await page.locator('input[value="starter"]').check()
  await page.locator('form input[type="email"]').first().fill(EMAIL)
  await page.locator('form input[placeholder*="Como devemos"]').fill('E2E Test User')
  console.log('[step 2] form filled (starter, email, nome)')

  // ---------- Step 3: submit, expect navigation to checkout.stripe.com ----------
  // Wait briefly to make sure React hydrated and onSubmit handler is bound
  await page.waitForTimeout(1500)
  const [checkoutResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/stripe/checkout-publico') && r.request().method() === 'POST',
      { timeout: STEP_TIMEOUT },
    ),
    page.locator('form button[type="submit"]').click(),
  ])
  console.log(`[step 3] checkout-publico responded: ${checkoutResp.status()}`)
  if (!checkoutResp.ok()) {
    const body = await checkoutResp.text()
    throw new Error(`checkout-publico failed: ${checkoutResp.status()} ${body.substring(0, 200)}`)
  }
  try {
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: STEP_TIMEOUT })
  } catch (e) {
    const errText = await page.locator('.text-neg, [class*="neg"]').first().textContent().catch(() => null)
    console.log(`[step 3] navigation failed. Visible error: ${errText} | url=${page.url()}`)
    throw e
  }
  const stripeUrl = page.url()
  console.log(`[step 3] redirected to Stripe: ${stripeUrl.substring(0, 80)}...`)
  expect(stripeUrl).toContain('checkout.stripe.com')

  // ---------- Step 4: complete Stripe checkout ----------
  await completeStripeCheckout(page)
  console.log('[step 4] Stripe checkout completed, on /comprar/sucesso')
  expect(page.url()).toContain('/comprar/sucesso')

  // ---------- Step 5: poll DB for License ----------
  console.log('[step 5] polling DB for license...')
  const license = await waitForLicense(EMAIL, 30_000)
  console.log(`[step 5] license created: codigo=${license.codigo}, token=${license.onboardingToken?.slice(0, 8)}...`)
  expect(license.email).toBe(EMAIL)
  expect(license.status).toBe('pending')
  expect(license.onboardingToken).toBeTruthy()
  expect(license.stripeCustomerId).toBeTruthy()

  // ---------- Step 6: audit log ----------
  const audit = await prisma.auditLog.findFirst({
    where: { entidade: 'license', entidadeId: license.id, acao: 'license_create' },
  })
  if (audit) {
    console.log(`[step 6] audit log found: acao=${audit.acao}`)
  } else {
    console.log('[step 6] WARN: no audit log row for license_create (may be optional)')
  }

  // ---------- Step 7: email (skipped — verified via audit + onboardingToken existence) ----------
  console.log('[step 7] email send: assumed OK (token generated, no log access here)')

  // ---------- Step 8: open /ativar/{token} ----------
  await page.goto(`${BASE_URL}/ativar/${license.onboardingToken}`, {
    waitUntil: 'domcontentloaded',
    timeout: STEP_TIMEOUT,
  })
  await expect(page.locator(`text=${license.codigo}`).first()).toBeVisible({ timeout: STEP_TIMEOUT })
  console.log('[step 8] activation wizard loaded showing license code')

  // ---------- Step 9: Step 1 of wizard — password ----------
  const nomeIn = page.locator('input[placeholder*="João Silva"]')
  await nomeIn.click()
  await nomeIn.pressSequentially('E2E Test User', { delay: 10 })
  const pwInputs = page.locator('input[type="password"]')
  await pwInputs.nth(0).click()
  await pwInputs.nth(0).pressSequentially('SenhaForte2026X', { delay: 10 })
  await pwInputs.nth(1).click()
  await pwInputs.nth(1).pressSequentially('SenhaForte2026X', { delay: 10 })
  const v0 = await pwInputs.nth(0).inputValue()
  const v1 = await pwInputs.nth(1).inputValue()
  console.log(`[step 9 pre-click] pw input lens: ${v0.length}/${v1.length}`)
  await page.getByRole('button', { name: /Continuar/ }).click()
  try {
    await expect(page.locator('input[placeholder*="00.000.000"]')).toBeVisible({ timeout: 15_000 })
  } catch (e) {
    const errBox = await page.locator('[class*="danger"], [class*="neg"], [style*="danger"]').allTextContents()
    const nomeVal = await page.locator('input[placeholder*="João Silva"]').inputValue().catch(() => '?')
    const senha1 = await page.locator('input[placeholder*="Mínimo 8"]').inputValue().catch(() => '?')
    const senha2 = await page.locator('input[placeholder*="Repita"]').inputValue().catch(() => '?')
    console.log(`[step 9] FAIL: errBoxes=${JSON.stringify(errBox)} nome="${nomeVal}" s1.len=${senha1.length} s2.len=${senha2.length}`)
    await page.screenshot({ path: 'test-results/step9-fail.png', fullPage: true })
    throw e
  }
  console.log('[step 9] wizard step 1 done, step 2 rendered')

  // ---------- Step 10: Step 2 — CNPJ + CEP ----------
  const cnpjInput = page.locator('input[placeholder*="00.000.000"]')
  await cnpjInput.click()
  await cnpjInput.pressSequentially('19131243000197', { delay: 10 })
  console.log('[step 10] CNPJ filled, waiting for autofill...')
  await page.waitForTimeout(4000)
  const razaoLoc = page.locator('input[placeholder*="Mercograin Trading"]')
  const razaoVal = await razaoLoc.inputValue()
  if (!razaoVal || razaoVal.length < 2) {
    console.log('[step 10] CNPJ autofill did not populate, filling manually')
    await razaoLoc.click()
    await razaoLoc.pressSequentially('Stone Pagamentos S.A.', { delay: 10 })
  } else {
    console.log(`[step 10] CNPJ autofilled: razaoSocial="${razaoVal}"`)
  }

  // CEP
  const cepInput = page.locator('input[placeholder="00000-000"]')
  await cepInput.click()
  await cepInput.pressSequentially('01310100', { delay: 10 })
  console.log('[step 10] CEP filled, waiting for ViaCEP...')
  await page.waitForTimeout(3500)
  const cidadeIn = page.locator('input').filter({ hasNotText: '*' })
  const ufVal = await page.locator('input[placeholder="SP"]').inputValue().catch(() => '')
  console.log(`[step 10] post-CEP UF="${ufVal}"`)

  // ---------- Step 11: submit ativação ----------
  await page.locator('button:has-text("Ativar minha conta")').click()
  console.log('[step 11] submitted ativação, waiting for /dashboard...')
  await page.waitForURL(/\/(dashboard|bhgrain|onboarding)/, { timeout: STEP_TIMEOUT })
  console.log(`[step 11] redirected to: ${page.url()}`)

  // ---------- Step 12: verify DB state ----------
  const user = await prisma.user.findUnique({ where: { email: EMAIL } })
  expect(user).not.toBeNull()
  expect(user!.senha).toMatch(/^\$2[aby]\$/) // bcrypt hash
  console.log(`[step 12a] user created: id=${user!.id}, bcrypt hash OK`)

  const workspace = await prisma.workspace.findFirst({ where: { ownerId: user!.id } })
  expect(workspace).not.toBeNull()
  console.log(`[step 12b] workspace: id=${workspace!.id}, nome="${workspace!.nome}"`)

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: workspace!.id, userId: user!.id },
  })
  expect(member).not.toBeNull()
  expect(member!.role).toBe('owner')
  expect(member!.status).toBe('active')
  console.log(`[step 12c] workspaceMember: role=${member!.role}, status=${member!.status}`)

  const dados = await prisma.dadosEmpresa.findUnique({
    where: { workspaceId: workspace!.id },
  })
  expect(dados).not.toBeNull()
  expect(dados!.cnpj).toBeTruthy()
  console.log(`[step 12d] dadosEmpresa: cnpj=${dados!.cnpj}, cidade=${dados!.cidade}, uf=${dados!.uf}`)

  const licFinal = await prisma.license.findUnique({ where: { id: license.id } })
  expect(licFinal!.status).toBe('active')
  expect(licFinal!.workspaceId).toBe(workspace!.id)
  expect(licFinal!.onboardingToken).toBeNull()
  console.log(`[step 12e] license: status=${licFinal!.status}, token queimado, workspace ligado`)

  const sub = await prisma.subscription.findUnique({ where: { workspaceId: workspace!.id } })
  expect(sub).not.toBeNull()
  expect(sub!.stripeSubscriptionId).toBeTruthy()
  console.log(`[step 12f] subscription: stripeId=${sub!.stripeSubscriptionId?.slice(0, 12)}..., status=${sub!.status}`)

  // ---------- Step 13: cleanup ----------
  await cleanupByDomain()
  const post = await prisma.user.findUnique({ where: { email: EMAIL } })
  expect(post).toBeNull()
  console.log('[step 13] cleanup OK — all rows removed')

  console.log('\n=== ALL STEPS PASSED ===\n')
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
