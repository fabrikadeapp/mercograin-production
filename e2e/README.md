# E2E Tests — Playwright

## Setup

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

## Rodar

```bash
# Todos
npx playwright test

# Específico
npx playwright test e2e/auth/login.spec.ts

# UI mode (debug interativo)
npx playwright test --ui

# Headed (vê navegador)
npx playwright test --headed
```

## Estrutura

```
e2e/
  auth/        — Signup, login, recover, verify
  mesa/        — Criar proposta, contrato, aprovar, fluxo
  gestao/      — Equipe (convite, suspensão, transferência)
  laura/       — Ingest mensagem e ver no /laura
  smoke/       — Smoke tests pós-deploy
  fixtures/    — Helpers (login, criar workspace teste)
  playwright.config.ts
```

## Cobertura mínima alvo (20 testes críticos)

- [ ] auth/signup-flow.spec.ts (signup → verify → onboarding)
- [ ] auth/login.spec.ts (login válido + inválido + rate limit)
- [ ] auth/forgot-password.spec.ts
- [ ] mesa/criar-proposta.spec.ts (geração de número MCG...)
- [ ] mesa/aprovar-proposta.spec.ts (rascunho → aceita)
- [ ] mesa/proposta-para-contrato.spec.ts
- [ ] mesa/exportar-pdf.spec.ts
- [ ] gestao/convite-aceite.spec.ts
- [ ] gestao/transferir-carteira.spec.ts
- [ ] gestao/suspender-membro.spec.ts (acesso revogado)
- [ ] laura/ingest-mensagem.spec.ts
- [ ] laura/aprovar-proposta-laura.spec.ts
- [ ] financeiro/criar-movimento.spec.ts
- [ ] financeiro/comissoes-listar.spec.ts
- [ ] perfil/lgpd-export.spec.ts
- [ ] perfil/lgpd-delete.spec.ts (com guard de owner)
- [ ] admin/feature-flags.spec.ts (toggle)
- [ ] smoke/dashboard.spec.ts
- [ ] smoke/status-page.spec.ts
- [ ] smoke/health.spec.ts

## CI (configurado)

3 workflows ativos em `.github/workflows/`:

- **`ci.yml`** — type-check + build em todo push/PR em main
- **`e2e.yml`** — smoke (push+PR) e suite full (só PR) contra prod
- **`smoke-post-deploy.yml`** — smoke a cada 2h + alerta Slack em falha

Secrets necessários no GitHub:
- `LAURA_INGEST_SECRET` — pra testes de Laura ingest auth
- `E2E_TEST_USER` / `E2E_TEST_PASS` — pra testes autenticados (skip se ausente)
- `SLACK_WEBHOOK` — pra alertas (opcional)

Acompanhar runs: `https://github.com/fabrikadeapp/mercograin-production/actions`

## Estratégia

- **Banco isolado por suite**: usa workspace `e2e-test-{timestamp}` em prod ou DB dedicado em CI
- **Fixtures**: helper `loginAs(role)` que cria user+session via API direta
- **Cleanup**: cada teste limpa o que criou via API
- **Smoke separado**: roda em prod a cada deploy via cron, alerta se falhar
