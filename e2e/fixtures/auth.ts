/**
 * Fixtures de autenticação Playwright.
 *
 * Estratégia: login via UI usando credenciais de teste configuradas via
 * env (E2E_TEST_USER / E2E_TEST_PASS). Reuso de session via storageState.
 *
 * Se as envs não estão setadas, testes que dependem de auth marcam-se
 * como skipped (não falham).
 */

import { test as base, expect, type Page } from '@playwright/test'

const TEST_USER = process.env.E2E_TEST_USER
const TEST_PASS = process.env.E2E_TEST_PASS

export const hasTestCredentials = !!(TEST_USER && TEST_PASS)

export async function loginViaUI(page: Page): Promise<void> {
  if (!TEST_USER || !TEST_PASS) {
    throw new Error('E2E_TEST_USER / E2E_TEST_PASS não configurados')
  }
  await page.goto('/auth/login')
  await page.locator('input[name="email"], input[type="email"]').fill(TEST_USER)
  await page.locator('input[name="senha"], input[type="password"]').fill(TEST_PASS)
  await page.locator('button[type="submit"]').click()
  // Espera redirect — dashboard ou onboarding
  await page.waitForURL(/\/(dashboard|onboarding|bhgrain)/, { timeout: 15_000 })
}

/** Test wrapper: skip se não há credenciais. */
export const test = base.extend({})

export function skipIfNoAuth() {
  if (!hasTestCredentials) {
    test.skip(true, 'E2E_TEST_USER e E2E_TEST_PASS não configurados')
  }
}

export { expect }
