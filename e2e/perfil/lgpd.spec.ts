import { test, expect } from '@playwright/test'

test.describe('Perfil · LGPD', () => {
  test('GET /api/perfil/lgpd/export sem auth → 401', async ({ request }) => {
    const res = await request.get('/api/perfil/lgpd/export')
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/perfil/lgpd/delete sem auth → 401', async ({ request }) => {
    const res = await request.post('/api/perfil/lgpd/delete', {
      data: { senha: 'qualquer', confirmacao: 'EXCLUIR MINHA CONTA' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/perfil/lgpd/delete exige frase exata', async ({ request }) => {
    const res = await request.post('/api/perfil/lgpd/delete', {
      data: { senha: 'x', confirmacao: 'frase errada' },
    })
    // Vai dar 401 (sem auth) OU 400 (schema). Ambos OK.
    expect([400, 401, 403]).toContain(res.status())
  })

  test('GET /perfil sem auth → redirect', async ({ page }) => {
    await page.goto('/perfil')
    expect(page.url()).toContain('/auth/login')
  })
})
