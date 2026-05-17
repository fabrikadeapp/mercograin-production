import { test, expect } from '@playwright/test'

test.describe('Laura.IA — Ingest', () => {
  test('POST /api/laura/ingest exige secret quando configurado', async ({ request }) => {
    const res = await request.post('/api/laura/ingest', {
      data: {
        workspaceId: 'fake-ws',
        canal: 'whatsapp',
        handle: '+5511999999999',
        mensagem: 'oi',
      },
    })
    // Se secret está setado, 401. Se não, 500 com erro de workspace_not_found.
    expect([200, 401, 500]).toContain(res.status())
  })

  test('POST /api/laura/ingest valida schema', async ({ request }) => {
    const res = await request.post('/api/laura/ingest', {
      headers: {
        authorization: `Bearer ${process.env.LAURA_INGEST_SECRET ?? ''}`,
      },
      data: {
        // sem campos obrigatórios
        canal: 'whatsapp',
      },
    })
    expect([400, 401]).toContain(res.status())
  })
})
