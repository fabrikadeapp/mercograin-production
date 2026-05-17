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

## CI

Adicionar workflow GitHub Actions em `.github/workflows/e2e.yml`:

```yaml
name: E2E
on:
  pull_request:
    branches: [main]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          BASE_URL: ${{ secrets.E2E_BASE_URL }}
          TEST_USER_EMAIL: ${{ secrets.E2E_TEST_USER }}
          TEST_USER_PASSWORD: ${{ secrets.E2E_TEST_PASS }}
```

## Estratégia

- **Banco isolado por suite**: usa workspace `e2e-test-{timestamp}` em prod ou DB dedicado em CI
- **Fixtures**: helper `loginAs(role)` que cria user+session via API direta
- **Cleanup**: cada teste limpa o que criou via API
- **Smoke separado**: roda em prod a cada deploy via cron, alerta se falhar
