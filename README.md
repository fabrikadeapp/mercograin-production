# BH Grain — Trading System

> Sistema multi-tenant de mesa de operações para tradings de grãos (soja, milho, trigo). Originação, fixação, hedge, logística, fiscal, compliance EUDR, BI e portal do produtor — tudo em um único produto SaaS.

**Status (10/05/2026):** 100% de conformidade na auditoria final (68/68 checks · `npm run audit:compliance`).

> Codename do repo: `mercograin-production`. Produto comercial: **BH Grain**. **MercoGrain** é a corretora piloto cliente — não confundir com o produto.

---

## Estado atual

| Indicador | Valor |
|---|---|
| Conformidade auditoria final | **100% (68/68)** |
| Endpoints REST | ~268 |
| Modelos Prisma | 82 |
| Tests unitários | 150+ |
| Tests E2E (`node --test`) | 42 (7 suites) |
| Módulos M1–M10 | Todos a 100% |

---

## Módulos & Features

| Módulo | Conteúdo | Status |
|---|---|---|
| **M1 — Compliance KYC** | CGU + SmartLab/MTE + SICAR + ReceitaWS + CEAF (5 verificações por cliente PJ) | ✅ |
| **M2 — Mesa de Operações** | SSE realtime, OHLC intradia, book próprio, atalhos, cenários | ✅ |
| **M3 — Originação & Contratos** | Propostas, contratos preço-a-fixar, barter, templates Tiptap, hash imutável, aceite digital, assinatura ZapSign adapter | ✅ |
| **M4 — Operação Física & Logística** | Romaneios, balanças, tickets, OC kanban, CT-e/MDF-e, PWA offline | ✅ |
| **M5 — Risco** | VaR, limites, breach alerts, auditoria de cálculos, cron `risco-breaches` | ✅ |
| **M6 — Financeiro** | CNAB 240/400, Pix QR (BR Code), comissão hierárquica, aging, boletos Braspag, Stripe | ✅ |
| **M7 — Fiscal** | NF-e/NFP-e, SPED/ECD/ECF, DARF/GNRE, simulador UF (ICMS/diferimento) | ✅ |
| **M8 — BI** | KPIs C-Level (MRR, GMV), painel corretor, benchmarking anonimizado | ✅ |
| **M9 — EUDR / Rastreabilidade** | Cadeia de custódia (propriedade → talhão → lote), DDS PDF com hash, MapBiomas + sobreposição áreas protegidas | ✅ |
| **M10 — Portal do Produtor + 2FA** | Login produtor, 2FA TOTP (otpauth), cofre de documentos, chat trader↔produtor, conteúdo educacional, aceite digital com carimbo de tempo | ✅ |

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind |
| Backend | Next.js API Routes (Node 18+) |
| Banco | PostgreSQL · Prisma 5 |
| Auth | NextAuth v5 (Credentials + bcrypt) + 2FA TOTP (otpauth) |
| Pagamento | Stripe (Checkout + Webhook) · Braspag (boletos) |
| Mensageria | Evolution API v2.3.7 dedicada (Baileys) |
| Email | Resend (`profitsync.ia.br`) |
| Cotações | CEPEA/ESALQ · BCB PTAX · Twelve Data · AwesomeAPI |
| Observability | Sentry + audit log |
| Cache | Redis (ioredis) + Bull queue |
| Storage | Supabase Storage (uploads de logos/docs) |
| Hospedagem | Railway |
| Tests | `node:test` (zero-dep) + `__tests__/simple.test.js` framework |
| Docs API | OpenAPI 3.1 auto-gerada + Swagger UI via CDN (jsdelivr) |

---

## Setup local

```bash
# 1. clone
git clone https://github.com/fabrikadeapp/mercograin-production.git bh-grain
cd bh-grain

# 2. dependências
npm install

# 3. env
cp .env.example .env.local
# editar DATABASE_URL, NEXTAUTH_SECRET, etc

# 4. banco
npx prisma migrate dev
npx prisma generate
npm run db:seed-demo    # opcional: dados ficcionais MercoGrain

# 5. dev
npm run dev             # http://localhost:3000

# 6. tests
npm test                # unit (zero-dep)
npm run test:e2e        # E2E node:test (auth, contrato, kyc, dds, portal, aceite, hedge)
npm run test:all        # unit + e2e
npm run audit:compliance # re-auditoria 10 módulos (meta >= 98%)
```

API docs interativa: **http://localhost:3000/docs/api** (Swagger UI · OpenAPI em `/api/openapi.json`).

---

## Variáveis de ambiente

### Obrigatórias

| Var | Para que serve |
|---|---|
| `DATABASE_URL` | Postgres principal |
| `NEXTAUTH_URL` | URL pública (`https://www.profitsync.ia.br`) |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | Sessão NextAuth |
| `AUTH_TRUST_HOST` | `true` em Railway/Vercel |

### Pagamento

| Var | Notas |
|---|---|
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Test mode hoje; live mode é flip via dashboard |
| `STRIPE_PRICE_STARTER` / `_PRO` / `_ENTERPRISE` | IDs dos preços |
| `BRASPAG_MERCHANT_ID` / `BRASPAG_API_KEY` / `BRASPAG_ENVIRONMENT` | Boletos (sandbox por padrão) |

### Cotações

| Var | Fallback ZERO-CUSTO se ausente |
|---|---|
| `TWELVEDATA_API_KEY` | BCB PTAX (USDBRL) + CEPEA scrape (commodities) — ambos públicos e gratuitos |
| `CEPEA_USER` / `CEPEA_PASS` | scrape público (sem credencial) |

### Integrações

| Var | Fallback ZERO-CUSTO se ausente |
|---|---|
| `RESEND_API_KEY` | logger warning + persistência da mensagem em audit log |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE_NAME` | WhatsApp desabilitado graciosamente |
| `SENTRY_DSN` | logs vão para stdout |
| `REDIS_URL` | fallback in-memory (Bull desabilitado) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | storage local em `/public/uploads` |
| `ZAPSIGN_API_KEY` | mock provider (assinatura simulada — bom pra dev/demo) |
| `TRADINGVIEW_WEBHOOK_SECRET` | webhook desabilitado |

### Crons (Railway)

`sync-cotacoes`, `price-alerts`, `contrato-marcos`, `sync-areas-protegidas`, `marcacao-diaria`, `sync-listas-suja`, `trial-notifications`, `apurar-comissoes`, `risco-breaches`, `whatsapp-cotacao-diaria` — todos com endpoint `/api/cron/*` protegido por `CRON_SECRET`.

---

## Scripts npm

```bash
npm run dev                 # Next dev
npm run build               # next build
npm test                    # unit (simple framework)
npm run test:e2e            # 7 suites E2E (node:test, zero-dep)
npm run test:all            # unit + e2e
npm run audit:compliance    # re-auditoria 10 módulos (>=98%)
npm run db:migrate          # prisma migrate dev
npm run db:seed-demo        # popular MercoGrain demo
npm run db:studio           # Prisma Studio
npm run db:reset            # reset destrutivo
npm run type-check          # tsc --noEmit
npm run backup:run          # backup Postgres
```

---

## OpenAPI

- Geração filesystem-based (zero deps): `lib/openapi/spec.ts`
- Endpoint: `GET /api/openapi.json` (revalidate 1h)
- UI: `/docs/api` (Swagger UI 5 via jsdelivr CDN — sem dependência npm)

---

## Multi-tenancy

100% scopado por `workspaceId`. Helper `lib/auth/scope.ts` (`getScope`/`requireScope`) injeta `whereOwn({ workspaceId })` em todas as queries. Helper paralelo `lib/portal-produtor/scope.ts` para o portal.

---

## Licença

MIT
