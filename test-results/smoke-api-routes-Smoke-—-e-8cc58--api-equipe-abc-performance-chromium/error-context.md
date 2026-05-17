# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/api-routes.spec.ts >> Smoke — endpoints retornam 401 sem auth >> GET /api/equipe/abc/performance
- Location: e2e/smoke/api-routes.spec.ts:23:9

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: 500
Received array: [401, 403, 404]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | /**
  4  |  * Smoke API: garante que endpoints autenticados retornam 401 (não 500)
  5  |  * quando chamados sem cookie. Detecta endpoints que crasham antes da
  6  |  * checagem de auth.
  7  |  */
  8  | const PROTECTED_ENDPOINTS = [
  9  |   '/api/inbox',
  10 |   '/api/clientes',
  11 |   '/api/propostas',
  12 |   '/api/contratos',
  13 |   '/api/bhgrain/precos',
  14 |   '/api/bhgrain/health',
  15 |   '/api/bhgrain/insight',
  16 |   '/api/comissao/apuradas',
  17 |   '/api/admin/crons',
  18 |   '/api/equipe/abc/performance',
  19 | ]
  20 | 
  21 | test.describe('Smoke — endpoints retornam 401 sem auth', () => {
  22 |   for (const url of PROTECTED_ENDPOINTS) {
  23 |     test(`GET ${url}`, async ({ request }) => {
  24 |       const res = await request.get(url)
  25 |       // Aceitamos 401, 403, ou 404 (no caso de ids inválidos com guard early)
> 26 |       expect([401, 403, 404]).toContain(res.status())
     |                               ^ Error: expect(received).toContain(expected) // indexOf
  27 |     })
  28 |   }
  29 | })
  30 | 
```