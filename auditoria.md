# Auditoria — PHB Grain

> Snapshot técnico do sistema em **10/05/2026**.
> Domínio: https://www.profitsync.ia.br
> Hospedagem: Railway · Banco: Postgres · Stripe (test mode)
> Repositório: github.com/fabrikadeapp/mercograin-production

---

## 1. Identidade do produto

| Item | Valor |
|---|---|
| Nome comercial | PHB Grain |
| Tagline | Grain Intelligence · Mesa de operações para tradings de grãos |
| Stack | Next.js 14 (App Router) · React 18 · TypeScript · Prisma 5 · Postgres |
| Auth | NextAuth v5 (Credentials Provider · bcrypt) |
| Pagamento | Stripe (test mode) — produção pendente |
| Email | Resend (configurar `RESEND_API_KEY` para envio real) |
| WhatsApp | Evolution API v2.3.7 dedicada (Baileys) |
| Cotações | CEPEA/ESALQ · BCB PTAX · Twelve Data · AwesomeAPI |

---

## 2. Arquitetura Railway (projeto **PHB Grain**)

```
PHB Grain
├── web              ← App Next.js (https://www.profitsync.ia.br)
├── Postgres         ← Banco do app (clientes, contratos, etc.)
├── evolution-api    ← Evolution v2.3.7 dedicada
└── Postgres-1M2U    ← Banco isolado da Evolution
```

**Independência:** projeto **lauraia** (Laura.IA) não compartilha mais nenhum recurso. Verificado em 10/05/2026: zero instâncias PHB Grain em lauraia.

### Domínios
- `https://www.profitsync.ia.br` — landing + app
- `https://profitsync.ia.br` — alias (Locaweb DNS)
- `https://web-production-fd4af.up.railway.app` — fallback Railway
- `https://evolution-api-production-8b9f.up.railway.app` — Evolution

### Variáveis críticas no Railway
- `DATABASE_URL` — Postgres principal (multi-tenant)
- `NEXTAUTH_URL` — `https://www.profitsync.ia.br`
- `NEXTAUTH_SECRET`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`
- `TWELVEDATA_API_KEY` — cotações commodities CBOT
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME=phb-grain`

---

## 3. Schema Prisma — modelos principais

### Multi-tenancy
- **Workspace** — empresa do trader (1 owner + N membros)
- **WorkspaceMember** — `role: owner|admin|member|viewer`, `status: active|invited|suspended`
- **DadosEmpresa** (1-1 com Workspace) — razão social, CNPJ, endereço, logo, dados bancários

Todos os modelos de negócio escopados por `workspaceId`. Helper `lib/auth/scope.ts` (`getScope`/`requireScope`) injeta `whereOwn({ workspaceId })` em todas as queries.

### Negócio
- **User** — autenticação, role global (`admin`/`user`/`viewer`), stripeCustomerId
- **Cliente** — CRM do trader
- **Fornecedor** — transportadoras, armazéns, insumos, certificadoras
- **Proposta** (com `graos: Json[]`)
- **Contrato** — gerado de Proposta aceita
- **ContratoFuturo** — book próprio por vencimento (B3 sintético)
- **Boleto** — cobrança Braspag
- **Classificado** — marketplace público entre workspaces
- **AlertaPreco** — alertas customizados pelo user
- **ContratoTemplate** — Tiptap JSON com placeholders
- **Cotacao** / **TaxaCambio** — histórico CEPEA/Twelve Data persistido

### Logística
- **Armazem** — próprio ou terceirizado (FK Fornecedor)
- **Motorista** — vinculado a transportadora
- **OrdemCarga** — kanban agendada/em_transito/entregue + CT-e + auto-numero `OC-{ano}-{seq}`

### Pagamento
- **Plan** — `slug`, `priceCents`, `includedMembers`, `extraMemberPriceCents`, `stripeProductId`, `stripePriceId`, `legacyPriceIds[]`
- **PlanFeature** — bullet points por plano
- **Subscription** (1-1 Workspace) — `status`, `plan`, `trialEnd`, `currentPeriodEnd`, `memberCount`, `extraSeatsCount`, `stripeSeatsItemId`
- **PricingRevision** — singleton para cache-bust

### Auxiliares
- **AuditLog**, **WebhookLog**, **CacheData**, **EmailVerificationToken**, **PasswordResetToken**

---

## 4. Páginas — frontend

### Públicas (sem auth)
- `/` — Landing comercial (Hero, LiveProof CEPEA, Features, Screenshot, Pricing dinâmico, FAQ, Footer)
- `/precos` — Pricing detalhado com tabela comparativa de features
- `/sobre`, `/contato` (com form), `/legal/{termos,privacidade}`
- `/auth/{login,signup,forgot-password,reset-password,verify-email,verify-email-pending,resend-verification}`

### Trader (autenticadas, scopadas por workspace)
- `/dashboard` — 4 MarketCards (Soja/Milho/Trigo/Dólar) com book bid/ask + Book de Futuros B3 + Curva de Mercado (À Vista/FOB/B3/CBOT) + Batimento de Meta + KPIs + Demanda Global + Top Contratos + Card Logística
- `/cotacoes` — Watchlist, gráfico grande, alertas, câmbio cruzado, notícias
- `/contratos` (lista + funil + detalhe + novo + editar) e `/contratos/templates` (CRUD com editor Tiptap)
- `/futuros` — book de futuros próprio (criar/editar contratos com vencimento)
- `/classificados` — marketplace público
- `/fluxo-de-caixa` — KPIs, projeção, a receber/pagar
- `/relatorios` — análises YTD, top clientes, origem/canal/logística
- `/clientes` (CRM) e `/fornecedores` (5 tipos)
- `/propostas` (lista + detalhe + nova + editar)
- `/boletos` (lista + detalhe + novo) + `/boletos/[id]/refresh-status`
- `/logistica` — Tabs Cargas (Kanban) + Armazéns + Motoristas
- `/whatsapp` — QR pareamento + envio + histórico
- `/assinatura` (status + trocar plano + portal Stripe + cancelar)
- `/onboarding` — wizard 6 steps (Empresa, Equipe, Clientes, Fornecedores, Template, Tour)
- `/auditoria` — log de ações próprias

### SuperAdmin (`role: admin`)
- `/admin` (Overview com MRR/usuários/trials/churn)
- `/admin/usuarios` + `/admin/usuarios/[id]`
- `/admin/assinaturas`
- `/admin/financeiro` (MRR/ARR/LTV/ARPU + Net New MRR)
- `/admin/conteudo/{classificados,alertas}`
- `/admin/operacional/{cotacoes,webhooks,auditoria}`
- `/admin/infra` — health check live (PG, Stripe, CEPEA, Twelve Data, Evolution)
- `/admin/pricing` (CMS de planos com drag-and-drop, sincroniza Stripe)

### Easter egg
- 5 cliques no logo da landing → modal SuperAdmin Portal

---

## 5. APIs — backend

### Públicas
- `/api/cotacoes/live`, `/api/cotacoes/sync`, `/api/cotacoes/historia`, `/api/cotacoes/historico`, `/api/cotacoes/watchlist`, `/api/cotacoes/book`, `/api/cotacoes/noticias`
- `/api/pricing` — planos ativos (cache 60s)
- `/api/contato` — formulário público

### Auth
- NextAuth `/api/auth/[...nextauth]`
- `/api/auth/{signup,forgot-password,reset-password,verify-email,resend-verification}`

### Workspace + onboarding
- `/api/workspace/{current,members,members/[id],invite/accept,empresa}`
- `/api/onboarding/{complete,logo}`

### Negócio (todas via `getScope` multi-tenant)
- `/api/clientes`, `/api/fornecedores`, `/api/propostas`, `/api/contratos`, `/api/contratos/funil`, `/api/contratos/templates`, `/api/contratos/[id]/render-pdf`, `/api/contratos/[id]/pdf`, `/api/futuros`, `/api/futuros/book`, `/api/futuros/cbot`, `/api/boletos`, `/api/boletos/[id]/refresh-status`, `/api/classificados`, `/api/alertas`, `/api/auditoria`
- Exports CSV: `/api/{clientes,fornecedores,propostas,contratos,boletos}/export`

### Dashboard agregados
- `/api/dashboard/{stats,batimento,demanda-exportacao}`, `/api/relatorios/resumo`, `/api/fluxo-caixa/resumo`, `/api/busca`

### Logística
- `/api/logistica/{armazens,motoristas,ordens,stats}` (+ subrotas)

### Stripe
- `/api/stripe/{checkout,webhook,portal,cancel}`

### WhatsApp (Evolution)
- `/api/whatsapp/{connect,status,send,disconnect,messages,notify}`

### SuperAdmin (todas com `requireAdmin`)
- `/api/admin/{overview,users,users/[id],users/export,users/[id]/{suspend,reactivate,impersonate},subscriptions,financeiro,audit,health,cotacoes/sync,pricing/plans,pricing/plans/[id],pricing/plans/[id]/features,pricing/features/[id],pricing/reorder}`

### Webhooks externos
- `/api/webhooks/{tradingview,braspag,signaturely,health,logs}`

---

## 6. Pricing & cobrança

### 3 planos editáveis no `/admin/pricing`
| Plano | Mensal | Membros inclusos | Membro extra |
|---|---|---|---|
| Starter | R$ 197 | 1 | R$ 150/mês |
| Pro | R$ 497 | 5 | R$ 150/mês |
| Enterprise | R$ 1.497 | 999 (ilimitado) | R$ 150/mês |

**Trial:** 10 dias com cartão (Stripe `trial_period_days: 10`, `payment_method_collection: always`).
**Cobrança extra de membros:** Stripe `subscriptionItems` separados, sincronizados via `lib/stripe/seats.ts` quando workspace muda nº de membros. Preço por membro extra é configurável por plano no painel admin (cria novo `Price` no Stripe quando muda valor, arquiva o antigo).

---

## 7. Cotações — fontes

| Símbolo | Fonte primária | Fallback | Atualização |
|---|---|---|---|
| Soja R$/sc 60kg | CEPEA/ESALQ widget | snapshot DB | diário ~14h |
| Milho R$/sc 60kg | CEPEA/ESALQ widget | snapshot DB | diário |
| Trigo R$/sc 60kg | CEPEA Trigo PR (R$/t convertido) | snapshot DB | diário |
| USD/BRL | **BCB PTAX** | AwesomeAPI → Twelve Data → cache stale | intra-day dias úteis |
| Soja/Milho/Trigo CBOT | Twelve Data ETFs (SOYB/CORN/WEAT) | — | tempo real (rate limit 8/min free) |
| EUR/BRL, CNY/BRL, ARS/BRL | Twelve Data | — | rate-limited |

**Detecção mercado aberto/fechado** (`lib/quotes/market-hours.ts`): horário Brasília + feriados nacionais. Cards exibem "ABERTO" verde pulsante / "FECHADO" vermelho com hint de próxima abertura. `changePct` zerado fora do horário.

---

## 8. Estado de produção em 10/05/2026

| Funcionalidade | Status | Observações |
|---|---|---|
| Landing comercial (`/`) | ✅ ativa | SEO básico, 5 cliques logo abrem portal admin |
| Cadastro/login | ✅ funcional | Reset por email pendente `RESEND_API_KEY` |
| Onboarding 6 steps | ✅ ativo | Persistência incremental validada |
| Dashboard com cotações reais | ✅ ativo | CEPEA + BCB PTAX em produção |
| Book de Futuros B3 + CBOT | ✅ ativo | Próprio (suas propostas) + ETF proxy |
| CRUD Clientes + Fornecedores | ✅ ativo | Filtros + export CSV |
| CRUD Propostas + Contratos | ✅ ativo | Auto-numero, status workflow |
| Templates de contrato (Tiptap) | ✅ ativo | 27 variáveis em 5 categorias, render PDF |
| Boletos Braspag | ⚠️ implementado | Necessita conta Braspag real para emitir |
| Logística (kanban) | ✅ ativo | Armazéns, motoristas, ordens com timeline |
| Fluxo de caixa | ✅ ativo | KPIs + projeção + a receber/pagar |
| Relatórios | ✅ ativo | YTD por grão, top clientes, eficiência |
| Classificados | ✅ ativo | Marketplace público entre workspaces |
| WhatsApp Evolution | ✅ funcional | v2.3.7 dedicada, Postgres isolado, QR ok |
| Stripe Checkout + Webhook | ✅ test mode | Trocar para live keys ao ir para produção |
| SuperAdmin `/admin` (11 páginas) | ✅ ativo | Health checks, MRR, gestão |
| Pricing CMS dinâmico | ✅ ativo | Edita plano → reflete landing/checkout |
| Multi-tenancy | ✅ migration aplicada | 100% scopado por `workspaceId` |
| Cobrança extra de membros | ✅ ativo | `lib/stripe/seats.ts` |
| Domínio + SSL | ✅ ativo | Locaweb DNS + Railway-edge SSL Let's Encrypt |
| Sistema de email | ⚠️ pendente env | `RESEND_API_KEY` precisa ser configurada |

---

## 9. Pendências conhecidas

1. **`RESEND_API_KEY`** — emails (signup, reset, welcome) só logam warning. Criar conta em resend.com, verificar domínio profitsync.ia.br, configurar no Railway.
2. **Stripe modo live** — trocar `STRIPE_SECRET_KEY` e `STRIPE_PUBLISHABLE_KEY` quando pronto pra cobrar real. Criar webhook live no dashboard Stripe.
3. **Twelve Data rate limit** — IP do Railway é compartilhado; free tier 8 req/min. USDBRL agora usa BCB primário (sem rate limit). Considerar plano Pro $79/mês para cotações CBOT mais robustas.
4. **Render PDF de tabelas em templates** — implementação simplificada por linhas (sem células flexbox por enquanto).
5. **Templates com loop de múltiplos grãos** (`{{#each produtos}}…`) — hoje só primeiro grão exposto.
6. **Chip visual de variável no editor** (Tiptap NodeView com background) — hoje aparecem como `{{key}}` plain text.
7. **Logo da empresa no header do PDF** — hoje não puxa `DadosEmpresa.logoUrl`.
8. **Integração B3 real** — futuros B3 hoje são book próprio (suas propostas). Para conectar feed B3 oficial precisa licença ~R$ 15k/mês.
9. **App mobile** — não há PWA nem React Native.
10. **Multi-idioma** — só pt-BR.
11. **SSL `profitsync.ia.br` raiz (sem www)** — opera via Railway-edge mas certificado emitido para www.

---

## 10. Acessos atuais (TEST MODE)

### SuperAdmin
- `aero.gus@hotmail.com` — `role: admin` — sua senha pessoal. Acessa `/admin`.

### Trader Enterprise (demo)
- `admin@mercograin.com` / `Admin@123456` — `role: user`, Subscription Enterprise active até 07/06/2026
- Workspace: **PHB Grain Trading** (LTDA, CNPJ 47.892.156/0001-89)
- Onboarding completo, 8 clientes, 8 fornecedores, 9 propostas, 4 contratos, 9 boletos, 15 contratos futuros, 6 ordens de carga, 2 templates, 4 alertas, 6 classificados.

### Stripe test
- Cartão: `4242 4242 4242 4242` · qualquer CVC · qualquer data futura

---

## 11. Histórico recente de mudanças

Resumo dos últimos 30 commits:

- `fbdb646` Evolution API v2.3.7 dedicada para PHB Grain (QR funcionando)
- `977f7a0` WhatsApp page com estado claro de manutenção
- `3ef058a` detecção real de mercado aberto/fechado por horário Brasília
- `f958247` BCB PTAX como fonte primária USDBRL
- `e2d7439` dolar correto via AwesomeAPI primário + propostas/nova fix
- `5153dc8` Onboarding wizard 6 steps + Templates editor + PDF render
- `9579d5d` Fornecedores CRUD + Logística completa + Reset senha funcional
- `f678d5d` workspace + cobrança seat extra editável via /admin/pricing
- `9aa8cf9` book de futuros B3 próprio + referência CBOT
- `19e0149`, `d1fea8b` portal secreto SuperAdmin
- `86ebf24`, `71ef3bb`, `abd8eab`, `532b271` book bid/ask híbrido + curva 4 toggles
- `502adc4` páginas comerciais públicas + Pricing CMS dinâmico
- `72a7f6e` multi-tenancy + landing comercial + Stripe trial 10d + SuperAdmin completo
- `13658b0`, `aaa34a0`, `fd1e657`, `aa34f2d`, `65106f9` integração CEPEA/ESALQ
- `905c2b3` substituição Yahoo Finance por Twelve Data
- `209c487` rename PHB Green → PHB Grain + dados ao vivo + WhatsApp + APIs reais
- `e88691f` aplicar design system PHB Green ao sistema completo

---

## 12. Próximos passos sugeridos

1. Configurar `RESEND_API_KEY` para envio real de emails transacionais
2. Validar fluxo Stripe end-to-end (checkout → webhook → assinatura ativa)
3. Trocar Stripe para live mode quando primeiros clientes pagantes assinarem
4. Considerar plano Twelve Data Pro para cotações CBOT robustas
5. Roadmap futuro: app mobile (PWA), integração B3 real (Enterprise+), multi-idioma, comissões/corretagem por trader

---

*Documento gerado por SuperAdmin orquestrador AIOS · projeto PHB Grain.*
