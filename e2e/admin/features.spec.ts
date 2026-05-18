import { test, expect } from '@playwright/test'

test.describe('Admin · Feature Flags', () => {
  test('GET /api/admin/workspaces/abc/features sem auth → 401/403', async ({ request }) => {
    const res = await request.get('/api/admin/workspaces/abc/features')
    expect([401, 403, 404]).toContain(res.status())
  })

  test('PATCH /api/admin/workspaces/abc/features sem auth → 401/403', async ({ request }) => {
    const res = await request.patch('/api/admin/workspaces/abc/features', {
      data: { feature: 'eudr', enabled: true },
    })
    expect([401, 403, 404]).toContain(res.status())
  })

  test('GET /admin/workspaces sem auth → redirect', async ({ page }) => {
    await page.goto('/admin/workspaces')
    expect(page.url()).toMatch(/\/(auth\/login|dashboard)/)
  })

  test('GET /admin/crons sem auth → redirect', async ({ page }) => {
    await page.goto('/admin/crons')
    expect(page.url()).toMatch(/\/(auth\/login|dashboard)/)
  })

  test('GET /api/admin/crons sem auth → 401/403', async ({ request }) => {
    const res = await request.get('/api/admin/crons')
    expect([401, 403]).toContain(res.status())
  })
})
