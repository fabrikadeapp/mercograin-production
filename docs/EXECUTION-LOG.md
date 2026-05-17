# Execution Log — Plano Atlas (7 Ondas)

**Início**: 2026-05-17
**Modo**: YOLO total, commits direto na main
**Decisões-chave do produto**:

- **Laura.IA**: usar OpenRouter (Llama-70B / Qwen) por enquanto. Estrutura
  abstrata (`LLMProvider` interface) permite trocar pra OpenAI quando houver
  budget. Custo alvo: ≈ $0 fixo + pay-per-use ínfimo.
- **Modelos legados**: NÃO dropar. Esconder atrás de **feature flags por
  workspace** geridas no super-admin. Cada cliente recebe os módulos que
  contratou. Estratégia de upsell de baixo CAC.
- **Usuário único** atualmente em prod. Deploy a qualquer hora.

## Ondas

### Onda 1 — Estabilidade de produção
- [x] (manual) DKIM/SPF/DMARC Resend
- [ ] PDF estável
- [ ] Padronizar 135 catches via error-response.ts
- [ ] Sentry alerts 5xx
- [ ] /admin/crons monitoring

### Onda 2 — Foundation
- [ ] Consolidar migrations
- [ ] Audit log automático
- [ ] pg_dump diário
- [ ] Feature flags por workspace
- [ ] 20 testes E2E críticos

### Onda 3 — UX & Performance
- [ ] Convergir design systems
- [ ] Atalhos teclado
- [ ] Mobile top 10
- [ ] Code-split heavy libs
- [ ] Streaming SSR dashboard

### Onda 4 — Segurança & Observabilidade
- [ ] RLS PostgreSQL
- [ ] Rate limit endpoints sensíveis
- [ ] CSP header
- [ ] 2FA obrigatório owner
- [ ] Audit append-only
- [ ] LGPD endpoints
- [ ] Trace ID propagado
- [ ] /status page

### Onda 5 — Laura.IA cérebro (OpenRouter)
- [ ] Schema LauraConversation/Message/Intent
- [ ] Webhook Evolution → ingest
- [ ] LLMProvider abstract
- [ ] Classifier intent (Llama-70B free)
- [ ] Extrator estruturado
- [ ] Validador cliente/cotação
- [ ] Notificação push autorização
- [ ] /laura painel métricas

### Onda 6 — Portal Produtor MVP
- [ ] Auditoria do schema existente
- [ ] Tela contratos do produtor
- [ ] Tela documentos
- [ ] Chat corretora
- [ ] Onboarding via convite/QR
- [ ] Push notifications PWA

### Onda 7 — Higiene contínua
- [ ] 32 TODOs
- [ ] Nomenclatura criadoEm/createdAt
- [ ] Toasts ID estável
- [ ] Loading states

## Log de execução

(populado conforme avançamos)
