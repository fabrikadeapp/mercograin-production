# Backlog Mercograin/BH Grain

**Última atualização**: 2026-05-18
**Status do produto**: pronto pra 1º cliente externo testar; falta polish pra escalar.

Itens marcados com 🔥 = bloqueiam venda pra 2º cliente.
Itens marcados com 💎 = oportunidade estratégica de receita.
Itens marcados com 🧹 = higiene técnica (não impacta usuário).

---

## P0 — Bloqueios pra venda externa (próximas 2 semanas)

### 🔥 Mobile responsive das 10 telas mais usadas
- **Esforço**: 1 dia
- **Por quê**: Trader vai abrir no celular em campo. UI atual assume ≥1024px.
- **Escopo**: `/bhgrain`, `/propostas`, `/propostas/[id]`, `/propostas/nova`, `/contratos`, `/contratos/[id]`, `/clientes`, `/financeiro`, `/laura`, `/aprovacoes/propostas`.
- **Critério**: passa em viewport iPhone 13 (390x844) sem scroll horizontal e sem texto cortado.

### 🔥 Stripe billing end-to-end validado
- **Esforço**: 4-6h
- **Por quê**: Schema existe (Subscription, Plan, PlanFeature) mas fluxo de cobrança nunca foi testado de cliente real.
- **Escopo**:
  - Testar `/assinatura/checkout` com cartão real (test mode)
  - Webhook `/api/stripe/webhook` processando eventos
  - Trial → paid → cancelled funcionando
  - Email de trial expirando (`trial-ending.ts`)

### 🔥 DNS bhgrain.com + Resend
- **Esforço**: 30min (você) + 30min (config)
- **Quando**: depois que comprar o domínio
- **Escopo**: apontar DNS pra Railway, criar zona Resend, DKIM/SPF/DMARC, atualizar `EMAIL_FROM` e `NEXT_PUBLIC_APP_URL`.

### 🔥 Audit log automático nos eventos críticos
- **Esforço**: 1 dia
- **Por quê**: compliance LGPD + debug em produção. Lib criada mas não plugada (quebra tipos Prisma).
- **Solução**: aplicação manual nos handlers críticos com `logAudit()` call explícito, ao invés de extension.
- **Cobertura mínima**:
  - Cliente create/update/delete (já tem)
  - Proposta autorizar/rejeitar (já tem)
  - Contrato assinar (faltando)
  - Boleto pago (faltando)
  - WorkspaceFeature toggle (faltando)
  - WorkspaceMember suspender/reativar (faltando)

---

## P1 — Polimento técnico (próximas 4 semanas)

### Convergir 3 design systems → NewDB v2
- **Esforço**: 1 dia
- **Por quê**: `components/ui/phb`, `newdb`, e CSS variables custom. Mistura visual.
- **Estratégia**: identificar componentes phb mais usados, fazer wrapper que renderiza newdb por baixo, deprecar gradualmente.

### Code-split @react-pdf + lucide-react dinâmico
- **Esforço**: 2h
- **Por quê**: `@react-pdf/renderer` ~2MB no bundle inicial. Lucide importa todos os ícones.
- **Solução**: `dynamic(() => import('@react-pdf/renderer'))` apenas no handler PDF + tree-shake lucide via `@lucide/react`.

### Telemetria do retry PDF
- **Esforço**: 1h
- **Por quê**: PDF tem 2 tentativas com 100ms delay. Quando trigger? Não temos visibilidade.
- **Solução**: Sentry capture quando attempt 2 dispara (`captureMessage('pdf_retry_needed', { attempt, error })`).

### Workflow GitHub Actions: bloqueio de merge em falha
- **Esforço**: 30min
- **Solução**: configurar branch protection rules → require CI + smoke pass.

### LauraMessage: gravar llmProvider/tokensIn/tokensOut/custoUsd
- **Esforço**: 2h
- **Por quê**: schema tem os campos mas pipeline não os grava. Sem telemetria de uso/custo LLM.
- **Solução**: alterar `processIncomingMessage` pra capturar `ChatCompletionResponse` e atualizar message.

### Consolidar 32 migrations manuais → uma Prisma versionada
- **Esforço**: 3h
- **Por quê**: rebuild do DB do zero impossível hoje. DR fica frágil.
- **Solução**: `prisma migrate diff` contra schema atual, salvar como `prisma/migrations/0001_initial/migration.sql`, marcar como applied.

### Erradicar TODOs externos (substituir mocks por dado real)
- **Esforço**: 1-2 semanas (distribuído)
- **Lista**:
  - `/api/dashboard/demanda-exportacao` → CONAB/MAPA/SECEX scraping
  - `/api/cotacoes/noticias` → CEPEA/Reuters/Bloomberg RSS
  - `/api/cotacoes/historia` → CEPEA FOB Paranaguá
  - `/api/cron/sync-areas-protegidas` → shapefile FUNAI + GeoJSON ICMBio
  - `/api/cron/sync-listas-suja` → CSV gov.br SmartLab
  - `/api/fiscal/sped` → já implementado (Volume Railway)

### Testes E2E autenticados (12 cenários)
- **Esforço**: 2 dias
- **Setup**: criar user `e2e-test@profitsync.ia.br` em produção, configurar `E2E_TEST_USER`/`PASS` secrets no GitHub.
- **Cobertura adicional**:
  - Criar proposta via UI (não só API)
  - Aprovar proposta no painel
  - Criar contrato a partir de proposta aceita
  - Convite de membro + aceite
  - Transferir carteira
  - Toggle feature flag
  - Export PDF proposta
  - Suspender membro → acesso revogado
  - Login + logout
  - LGPD export download
  - 2FA setup
  - Performance individual

---

## P2 — Frentes grandes de produto (próximos 3-6 meses)

### 💎 Twilio + Whisper voz (Laura telefone)
- **Esforço**: 3-4 dias
- **Por quê**: Diferencial competitivo. Cliente liga, Laura atende com voz.
- **Tech**: Twilio número BR (~$1/mês) → webhook grava áudio → Whisper Groq transcreve ($0.04/min) → pipeline existente da Laura processa.
- **Decisões pendentes**: número 0800 ou local? Mensagem de boas-vindas?
- **Custo runtime**: ~R$ 50/mês pra 100 ligações de 5min.

### 💎 Marketplace inter-workspace
- **Esforço**: 4-6 semanas
- **Por quê**: Receita transacional além de SaaS. Corretora A publica oferta, B aceita, Mercograin cobra fee.
- **Componentes**:
  - Fluxo de pagamento entre tenants (Stripe Connect)
  - NF de intermediação (já tem schema NotaFiscal)
  - Escrow / liberação após confirmação
  - Reputação / rating entre corretoras
  - Disputa / arbitragem

### 💎 Mobile PWA real (service worker + push)
- **Esforço**: 1 semana
- **Por quê**: trader em campo, recebe push de proposta nova
- **Tech**: schema `PushSubscription` existe. Falta:
  - `app/sw.ts` service worker registrado
  - `manifest.json` PWA (parcialmente existe)
  - `/api/push/send` handler
  - Subscribe UI em `/perfil/notificacoes`
  - Push em eventos: proposta aguardando autorização, contrato assinado, comissão paga

### 💎 BI sob demanda
- **Esforço**: 2 semanas
- **Por quê**: Add-on enterprise. CEO precisa relatório custom → request via UI → backend gera.
- **Tech**: query builder + exports (PDF/Excel/Google Sheets).

### 💎 EUDR como produto separado
- **Esforço**: 3 semanas
- **Por quê**: Mercado UE — exportadores BR de soja/café/cacau precisam compliance EUDR.
- **Tech**: schema completo (DDS, PropriedadeRural, Talhao, AreaProtegida, ListaSuja). Falta:
  - Página pública pra clientes que SÓ querem EUDR (não Mesa)
  - Submissão TRACES UE
  - Pricing standalone separado da Mesa

### 💎 Adiantamento + Originação como fintech
- **Esforço**: 4 semanas + compliance
- **Por quê**: Corretora adianta R$ pro produtor antes da colheita, cobra spread.
- **Bloqueio**: compliance financeiro (registro BCB, conta-escrow).

### Audit visual de design system
- **Esforço**: 4-6h
- **Por quê**: revisar todas as 191 rotas pra detectar componentes legados, screenshots Playwright + visual diff.

---

## P3 — Backlog técnico (qualquer hora)

### 🧹 RLS PostgreSQL — forçar workspace_id
- Hoje policies têm bypass quando `app.workspace_id` vazio.
- Próximo passo: criar Prisma middleware que faz `SET LOCAL app.workspace_id = '<id>'` antes de cada query autenticada.
- Quando: depois que tiver 2º workspace ativo (até lá não tem risco de vazamento).

### 🧹 Logging estruturado
- Hoje `console.error` espalhado.
- Solução: pino/winston com correlation ID nos handlers.

### 🧹 Auditar 93 modelos Prisma
- Identificar quais têm 0 rows há >30 dias.
- Candidatos a deprecar atrás de feature flag: classificados, originação parcial, romaneios.

### 🧹 Onboarding wizard UI completo
- Hoje cria workspace automaticamente mas Step1Empresa, Step2 etc precisam revisão visual + flow refinado.

### 🧹 Indexes de DB para queries lentas
- Rodar `EXPLAIN ANALYZE` em queries comuns.
- Candidatos: Proposta(workspaceId, status, criadaEm), Contrato(workspaceId, statusAssinatura).

### 🧹 OpenAPI / Swagger pra `/api/*`
- Schema OpenAPI já existe em `/api/openapi.json` mas tá incompleto.
- Atualizar com 313 endpoints reais.

### 🧹 Cleanup volumes órfãos Railway
- 12 volumes Postgres antigos ainda listados. CLI delete não removeu de fato.
- Ação: ticket suporte Railway OU painel web.

### 🧹 Limpar /admin/comissao-regras (UI inconsistente)
- Página existe mas design conflita com newdb.

### 🧹 Tests CI para endpoints autenticados
- Hoje 53 testes E2E só não-auth. Adicionar 12 com `loginViaUI`.

### 🧹 Sentry: configurar projeto real
- Hoje SDK instalado mas DSN não setado em prod (`SENTRY_DSN`).
- Sem isso erros vão pro console mas não viram alerta.

---

## ✅ Já entregue (referência rápida)

Arquitetura: 4 áreas, feature flags, RLS, audit log lib, error response lib, with-audit lib.
Mesa: numeração inteligente, autorização Laura, transferência carteira, performance individual.
Laura.IA: Groq+OpenRouter+OpenAI+Mock fallback, 3 propostas reais criadas via WhatsApp.
Infra: Railway DB+Volume, pg-backup, /admin/crons, cacheHandler custom, Cache-Control.
Segurança: RLS, 2FA opt-in, CSP, HSTS, rate limit mutations, JWT 4h, LGPD export+delete.
CI: 3 workflows GitHub Actions, 53 testes E2E.
UX: StatusTimeline, atalhos teclado, /status, /perfil, /laura.
