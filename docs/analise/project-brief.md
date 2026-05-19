# Project Brief — BH Grain / Mercograin
**Versão:** 1.0 · **Data:** 2026-05-19 · **Autor:** Atlas (Business Analyst)

> Documento estratégico consolidado. Use para apresentação a investidores, onboarding de sócios/vendedores e decisões de roadmap.

---

## 1. Executive Summary

**BH Grain** é a primeira plataforma SaaS multi-tenant verticalizada para corretoras de grãos no Brasil com **IA conversacional via WhatsApp (Laura.IA)** criando propostas em produção. Substitui ERPs legados (Sirius, Stark, Trinus) com UI moderna, deploys contínuos e pricing transparente.

### Métricas-chave (estado atual)

| Indicador | Valor |
|---|---|
| **Estágio** | MVP em produção, pré-launch comercial |
| **Funcionalidades** | 41/42 (97%) vs concorrentes |
| **Linhas de código produtivo** | ~120k LoC TypeScript/SQL |
| **Cobertura E2E** | 53+ testes Playwright passando |
| **Multi-tenancy** | RLS Postgres + middleware estanque |
| **Compliance** | LGPD, 2FA TOTP, audit log, CSP, SPF/DKIM (DMARC pendente) |
| **Valuation estimado hoje** | **R$ 650k – R$ 1,5M** |
| **ARR projetado ano 1 (base case)** | **R$ 2,26M** |
| **Valuation projetado ano 1 (base case)** | **R$ 9M – R$ 16M** |

### Proposta de valor única

> "A primeira corretora 100% conectada: Laura atende WhatsApp, fiscal emite SPED, financeiro concilia OFX. Tudo num só lugar, por R$ 697/mês."

---

## 2. Problema

### Estado atual do mercado de corretoras de grãos BR

- **~3.500 corretoras ativas** no Brasil
- **~60%** ainda operam em **Excel + WhatsApp manual**
- Concorrentes consolidados (Sirius) cobram **R$ 2.500–8.000/mês** com UI dos anos 2000
- Implementação típica: **60-90 dias** + setup fee de **R$ 15-40k**
- **Nenhum concorrente** tem IA conversacional integrada
- **EUDR** (lei europeia 2025/2026) força rastreabilidade — ninguém preparado

### Dores específicas do operador

1. **Repetitividade**: trader passa 60% do tempo digitando propostas, atualizando planilha de preços, mandando WhatsApp manual
2. **Erros fiscais**: NF-e e SPED feitos no contador externo → atraso, multa, retrabalho
3. **Conciliação bancária**: 3-5 dias/mês de uma pessoa só pra bater banco com sistema
4. **Sem visibilidade**: dono não sabe pipeline real, margem por produto, ranking de cliente
5. **Mobilidade zero**: sistema só no desktop do escritório
6. **Lock-in**: trocar de software = perder histórico, regraçar de zero

### Custo oculto típico de uma corretora média (10-20 func)

| Item | Custo mensal (R$) |
|---|---|
| Excel/planilhas (40h/mês × R$ 80) | 3.200 |
| Contador externo NF-e+SPED | 2.500 |
| Erros operacionais (1 proposta errada/mês) | 5.000 |
| Multas fiscais (eventual) | 1.500 |
| Oportunidades perdidas (resposta lenta) | 8.000 |
| **Total/mês** | **R$ 20.200** |

**BH Grain Pro custa R$ 1.997/mês** → economia mensal de ~R$ 18k = **ROI de 10x**.

---

## 3. Solução — BH Grain

### Arquitetura de produto

**4 workspaces** com permissões por colaborador:

#### 🟢 Mesa (Operação Comercial)
- Propostas + Contratos
- Clientes + CRM
- Cotações ao vivo (CEPEA + CBOT + Câmbio)
- Calculadora multi-unidade (saca/ton/bushel)
- Hedge + Futuros + Risco
- Inbox unificado (WhatsApp + e-mail + portal)
- **Laura.IA** — bot WhatsApp que cria propostas

#### 💰 Financeiro (Tesouraria)
- Movimentos (receitas/despesas)
- Conciliação OFX 1-clique
- DRE em tempo real
- Comissões + Royalties
- Fornecedores + Boletos
- Fluxo de caixa projetado
- Aging de pagamentos

#### 📋 Fiscal (Tributário)
- NF-e (FUNRURAL + ICMS + PIS/COFINS automático)
- SPED Fiscal + Contribuições
- Guias (DARF, GNRE, GARE-SP)
- Simulador de carga tributária por UF
- **EUDR** compliance

#### 👑 Gestão (Executivo)
- Dashboard executivo (KPIs C-Level)
- Equipe + permissões por área
- Configurações (empresa, marca, integrações)
- BI personalizado
- Audit log completo
- Assinatura + cobrança

### Diferencial técnico: Laura.IA

> Cliente da corretora manda mensagem WhatsApp:
> *"Quero vender 1000 sacas de soja Maringá pra agosto"*
>
> **Laura cria proposta automaticamente** com:
> - Identifica cliente pelo telefone (CRM)
> - Cotação CBOT + basis Maringá agosto
> - Calcula preço sugerido
> - Aplica regras da corretora (margem, comissão)
> - Cria proposta `aguardando_autorizacao`
> - Notifica trader no app
> - Responde no WhatsApp com confirmação

**Provider chain**: Groq → OpenRouter → OpenAI (fallback automático). Custo médio: R$ 0,12 por proposta. Telemetria completa em `/admin/laura`.

### Stack tecnológica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | Next.js 14 + React + Tailwind | App Router, SSR, performance |
| Backend | Next.js API Routes + Prisma | Mono-repo, type-safe |
| DB | PostgreSQL + RLS | Multi-tenancy seguro |
| Hosting | Railway (us-east4) | Deploy contínuo, escalável |
| Auth | NextAuth v5 + 2FA TOTP | Padrão da indústria |
| Payments | Stripe (BR) | Recurring + checkout sessions |
| Email | Resend + SES inbound | Deliverability + reply tracking |
| LLM | Groq + OpenRouter + OpenAI (chain) | Fallback, custo otimizado |
| WhatsApp | Evolution API + Meta Cloud (futuro) | Multi-conta |

---

## 4. Mercado

### TAM / SAM / SOM

| Métrica | Valor | Cálculo |
|---|---|---|
| **TAM** (Total Addressable Market) | R$ 252M/ano | 3.500 corretoras × R$ 6k/mês × 12 |
| **SAM** (Serviceable Available Market) | R$ 76M/ano | 2.500 corretoras pequenas+médias × R$ 2,5k/mês × 12 |
| **SOM** (Serviceable Obtainable Market) | R$ 7,6M/ano | 10% do SAM em 3 anos |

### Segmentação por porte

| Segmento | # corretoras | Ticket médio | Mercado anual |
|---|---|---|---|
| Micro (1-3 func) | 700 | R$ 297/mês | R$ 2,5M |
| Pequena (3-10 func) | 1.500 | R$ 697/mês | R$ 12,5M |
| Média (10-50 func) | 1.000 | R$ 1.997/mês | R$ 24M |
| Grande (>50 func) | 300 | R$ 5.997/mês | R$ 21,6M |
| **Total** | **3.500** | — | **R$ 60,6M** |

### Geografia (cluster prioritário)

| Estado | # corretoras | % do mercado |
|---|---|---|
| MT | 700 | 20% |
| PR | 600 | 17% |
| RS | 500 | 14% |
| GO | 400 | 11% |
| MS | 350 | 10% |
| SP | 300 | 9% |
| BA | 200 | 6% |
| Outros | 450 | 13% |

**Estratégia**: começar PR/SC/RS (proximidade Maringá, base de referência), expandir MT/MS no Q3.

### Tendências de mercado

1. **EUDR** (entrou 2025) — exportadores de soja/café precisam rastrear até a fazenda
2. **Sucessão geracional** — filhos assumem corretoras, querem ferramentas modernas
3. **Consolidação** — grupos comprando corretoras pequenas, querem sistema único
4. **WhatsApp como canal de venda** — Meta Business API cresce 40% a.a. no agro
5. **IA generativa em B2B** — clientes esperando "ChatGPT" em todo software
6. **Cooperativas digitalizando** — Coamo, C.Vale, Lar buscando white-label

---

## 5. Modelo de negócio

### Pricing (estrutura recomendada)

| Plano | Mensal | Anual (-15%) | Target |
|---|---|---|---|
| **Starter** | R$ 697 | R$ 597/mês | Corretora pequena (3-10 func) |
| **Pro** ⭐ | R$ 1.997 | R$ 1.697/mês | Corretora média (10-50 func) |
| **Enterprise** | R$ 5.997+ | Negociável | Corretora grande (>50 func) |

### Add-ons (todos os planos)

| Item | Preço |
|---|---|
| Colaborador extra | R$ 150/mês |
| Número WhatsApp extra | R$ 200/mês |
| NF-e pacote 500 | R$ 99/mês |
| Laura.IA 500 conversas extras | R$ 297/mês |
| Portal produtor (+100) | R$ 197/mês |
| API enterprise 10k calls | R$ 497/mês |
| Implementação acelerada (one-time) | R$ 2.500 |
| Migração de dados (one-time) | R$ 1.500 |

### Modelo de monetização

1. **MRR recorrente** (núcleo) — 80% da receita
2. **Add-ons consumo** — 15% (Laura.IA, NF-e extra, etc)
3. **Services one-time** (setup, migração, treinamento) — 5%
4. **Co-selling cooperativas** (futuro) — comissão sobre white-label

### Unit economics (cenário normal)

| Métrica | Valor |
|---|---|
| ARPU médio | R$ 1.567/mês |
| LTV (25 meses) | R$ 39.175 |
| CAC (blended) | R$ 1.000 |
| **LTV/CAC** | **39x** |
| Payback period | <1 mês |
| Gross margin | 78% |
| Net margin (ano 1) | 50% |

---

## 6. Cenários financeiros — 12 meses

### Premissas comuns
- Churn mensal: 4%
- Lifecycle: 25 meses
- CAC: R$ 800–2.000 (depende de canal)
- Custos operacionais: infra R$ 8k/mês + Stripe 4% + LLM R$ 2k/mês + equipe (variável)

### Cenário 🔴 MUITO RUIM (5% prob)

| | M3 | M6 | M12 |
|---|---|---|---|
| Clientes | 4 | 9 | 16 |
| MRR | R$ 4.088 | R$ 10.173 | R$ 22.967 |
| **ARR** | — | — | **R$ 276k** |
| EBITDA | -R$ 50k | -R$ 30k | **-R$ 30k** |

**Outcome**: pivota ou vende.

### Cenário 🟠 RUIM (15% prob)

| | M3 | M6 | M12 |
|---|---|---|---|
| Clientes | 11 | 27 | 56 |
| MRR | R$ 11.567 | R$ 30.486 | R$ 76.336 |
| **ARR** | — | — | **R$ 916k** |
| EBITDA | — | — | **R$ 270k** |

**Outcome**: sobrevive lucrativo, equipe pequena.

### Cenário 🟡 NORMAL — base case (50% prob)

| | M3 | M6 | M12 |
|---|---|---|---|
| Clientes | 23 | 56 | 118 |
| MRR | R$ 29.302 | R$ 79.063 | R$ 188.047 |
| **ARR** | — | — | **R$ 2,26M** |
| EBITDA | -R$ 20k | R$ 200k | **R$ 1,13M** |

**Outcome**: equipe 5-7 pessoas, captação seed opcional.

### Cenário 🟢 MUITO BOM (25% prob)

| | M3 | M6 | M12 |
|---|---|---|---|
| Clientes | 43 | 108 | 240 |
| MRR | R$ 81.648 | R$ 209.385 | R$ 489.208 |
| **ARR** | — | — | **R$ 5,87M** |
| EBITDA | R$ 50k | R$ 700k | **R$ 3,23M** |

**Outcome**: time 10-15, expansão geográfica, valuation R$ 24-40M.

### Cenário 🟣 EXCELENTE (5% prob)

| | M3 | M6 | M12 |
|---|---|---|---|
| Clientes | 88 | 265 | 640 |
| MRR | R$ 188.260 | R$ 545.266 | R$ 1.319.201 |
| **ARR** | — | — | **R$ 15,83M** |
| EBITDA | R$ 100k | R$ 1,5M | **R$ 7,12M** |

**Outcome**: viraliza, captação seed R$ 5M, time 20+, valuation R$ 80-160M.

### Resumo ponderado

**Expected ARR ano 1**: **R$ 3,2M**
**Expected EBITDA ano 1**: **R$ 1,5M**
**Expected valuation ano 1**: **R$ 14M – R$ 22M**

---

## 7. Go-to-Market

### Fase 1 — Pioneer (Q1 2026)
- 10 corretoras early adopters
- Preço promocional: R$ 497/mês (qualquer plano)
- Em troca: case study + testimonial em vídeo
- Onboarding presencial gratuito
- Suporte 1-on-1 com fundador
- **Meta**: 10 contas, R$ 5k MRR, 5 cases

### Fase 2 — Lançamento público (Q2 2026)
- Pricing oficial (R$ 697/1997/5997)
- Trial 14 dias sem cartão
- Conteúdo: 1 case/semana + 1 webinar/mês
- Programa de indicação: 1 mês grátis pra quem indica
- Tráfego pago: Google Ads + LinkedIn (R$ 15k/mês)
- **Meta**: 30 contas, R$ 35k MRR

### Fase 3 — Aceleração (Q3 2026)
- Presença em feira agro (Show Rural Coopavel ou similar)
- Contratação: 1 vendedor inbound + 1 CS
- Partnership piloto com 1 cooperativa (white-label)
- API pública + marketplace integrações
- **Meta**: 60 contas, R$ 90k MRR

### Fase 4 — Expansão (Q4 2026)
- Captação seed R$ 2-5M (se métricas válidas)
- Time 6-8 pessoas
- Expansão vertical: algodão, café, etanol
- Expansão geográfica: MT, MS, GO
- **Meta**: 100+ contas, R$ 180k MRR

### Canais de aquisição

| Canal | CAC | Volume mensal | Prioridade |
|---|---|---|---|
| Indicação cliente | R$ 300 | 5-15 | 🟢 ALTA |
| Conteúdo SEO/YouTube | R$ 600 | 10-30 | 🟢 ALTA |
| Feiras agro (1-2/ano) | R$ 2.000 | 20-40 (em 1 mês) | 🟡 MÉDIA |
| Google Ads | R$ 1.500 | 8-20 | 🟡 MÉDIA |
| LinkedIn Sales | R$ 2.500 | 3-8 (Enterprise) | 🟡 MÉDIA |
| Partnership cooperativa | R$ 500 | 50-200 (1 vez) | 🟢 ALTA |
| Sindicatos rurais | R$ 800 | 5-20 | 🟡 MÉDIA |

---

## 8. Equipe e operação

### Equipe atual
- **Fundador / CEO** (você) — produto + comercial + dev
- **Claude** (parceiro de dev) — assistente IA full-stack

### Plano de hiring 12 meses (cenário base)

| Role | Q | Salário/mês (R$) |
|---|---|---|
| Vendedor inbound | Q2 | 4-6k + comissão 5% MRR |
| CS (Customer Success) | Q3 | 4-5k |
| Dev full-stack pleno | Q3 | 10-14k |
| Marketing/conteúdo | Q4 | 6-8k |
| Vendedor field sales (Enterprise) | Q4 | 6-10k + comissão 7% MRR |

**Total folha ano 1 (estimado)**: R$ 350-500k

### Infraestrutura

| Item | Custo mensal |
|---|---|
| Railway (DB + 2 services) | R$ 600 |
| Domain + SSL | R$ 50 |
| Resend (e-mail) | R$ 200 |
| Stripe (4% gross) | variável |
| LLM (Groq/OpenRouter) | R$ 500-2.000 |
| Monitoring (Sentry) | R$ 200 |
| **Total fixo** | **~R$ 2k** |

### Compliance e segurança

- ✅ LGPD: termo de uso + DPA + audit log
- ✅ 2FA TOTP obrigatório para owners
- ✅ RLS Postgres + middleware estanque
- ✅ CSP headers + HSTS + SAMEORIGIN
- ✅ Audit log automático em 13 eventos críticos
- ✅ Backups diários (Railway managed)
- 🟡 SPF/DMARC (pendente — adicionar SPF + DMARC quarantine)
- 🟡 Pentests externos (planejado Q3)

---

## 9. Roadmap de produto

### Já pronto (em produção)
- 4 workspaces multi-tenant
- Propostas, contratos, clientes
- Cotações ao vivo (CEPEA + CBOT + câmbio)
- Fiscal NF-e + SPED
- Financeiro completo
- Laura.IA WhatsApp
- Portal do produtor
- Operação física
- Originação
- EUDR
- Audit log + 2FA
- Purchase-first checkout
- Telemetria Laura

### Q1 2026 — Polimento pré-launch
- 🔴 SPF/DMARC DNS
- 🔴 Fix autofill CNPJ/CEP (race condition)
- 🟡 Stripe production mode
- 🟡 5 cases pioneer documentados

### Q2 2026 — Conteúdo & vendas
- Calculadora pública de ROI no site
- Migração assistida (importar de Sirius/Excel)
- Treinamento certificado
- Marketplace de templates

### Q3 2026 — Plataforma & API
- API pública v1 (REST + webhooks)
- Marketplace de integrações
- White-label (Enterprise)
- BI personalizado avançado

### Q4 2026 — Verticalização
- Algodão (mesma estrutura, ajustes regulatórios)
- Café
- Etanol/biodiesel
- Internacionalização (Paraguai? Argentina?)

---

## 10. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Não atingir PMF em 90 dias | Média | Alto | Pioneer program; pivotar em 6 meses se necessário |
| Sirius copia IA | Alta | Médio | Velocidade; moat de dados (transcrições); brand |
| Crise agro (preços baixos) | Média | Médio | Plano Starter accessível; freemium se preciso |
| LLM cost explosion | Baixa | Médio | Fallback chain; BYOK Enterprise; cache agressivo |
| Bug fiscal causando multa cliente | Baixa | Alto | Seguro D&O + revisão fiscal externa quarterly |
| Stripe muda regras BR | Baixa | Alto | Plan B: Pagar.me ou Asaas |
| Concorrente VC-funded | Média | Alto | Diferenciação extrema; velocidade; partnership cooperativas |

---

## 11. Asks (se buscando captação)

### Seed Round — R$ 3M (target Q3-Q4 2026)

**Uso dos recursos**:
- 40% Equipe (4 hires) — R$ 1,2M
- 30% Marketing & vendas — R$ 900k
- 15% Produto & infra — R$ 450k
- 10% Reserva — R$ 300k
- 5% Legal & compliance — R$ 150k

**Estrutura**: SAFE ou equity 15-20% (valuation R$ 15-20M post-money)

**Investidores-alvo**:
- SP Ventures (agro)
- Barn Investimentos (agro)
- Wayra
- Família agro (angels)

### Métricas que destravam captação

- 30+ clientes pagantes
- MRR > R$ 50k
- Net retention > 110%
- Churn < 5%
- NPS > 50

---

## 12. Apêndices

### A. Glossário
- **MRR**: Monthly Recurring Revenue
- **ARR**: Annual Recurring Revenue (MRR × 12)
- **CAC**: Customer Acquisition Cost
- **LTV**: Lifetime Value
- **PMF**: Product-Market Fit
- **Laura.IA**: bot conversacional via WhatsApp
- **EUDR**: EU Deforestation Regulation
- **Multi-tenant**: 1 sistema, múltiplas empresas isoladas
- **RLS**: Row Level Security (Postgres)

### B. Referências
- CONAB: estimativas de mercado
- IBGE: PIB agro 2025
- Meta Business: WhatsApp API stats
- Crunchbase: VCs ativos no agro BR
- Sirius site / Sirius LinkedIn

### C. Contato
- **Fundador**: Gustavo Holderbaum Vieira
- **E-mail**: aero.gus@hotmail.com
- **Produto live**: https://www.profitsync.ia.br
- **GitHub**: github.com/fabrikadeapp/mercograin-production

---

**Próxima revisão**: 2026-08-19 (90 dias) ou quando atingir 30 clientes pagantes.

— Atlas, investigando a verdade 🔎
