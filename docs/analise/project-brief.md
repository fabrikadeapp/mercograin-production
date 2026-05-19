# Project Brief — BH Grain / Mercograin
**Versão:** 2.0 (recalibrado) · **Data:** 2026-05-19 · **Autor:** Atlas (Business Analyst)

> Documento estratégico consolidado. Use para apresentação a investidores, onboarding de sócios/vendedores e decisões de roadmap.
>
> **Nota de calibração v2.0**: premissas v1 foram corrigidas. Churn ajustado de 4% para 10% (realidade SaaS B2B BR ano 1), CAC de R$ 1k para R$ 3,5k (ciclo agro), valuation múltiplos de 4-10x ARR para 3-5x (mercado 2026), conversão sobre TAM acessível (não TAM total). Cenários reduzidos ~70% em ARR.

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
| **Compliance** | LGPD, 2FA TOTP, audit log, CSP, DKIM (SPF/DMARC pendente) |
| **Valuation estimado hoje** | **R$ 500k – R$ 1M** |
| **ARR projetado ano 1 (base case honesto)** | **R$ 678k** |
| **Valuation projetado ano 1 (base case)** | **R$ 2M – R$ 3,5M** |
| **Expected ARR ponderado ano 1** | **R$ 805k** |

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

### TAM / SAM / SOM (recalibrado v2 — honesto)

A v1 confundia TAM teórico (corretoras × preço máximo) com mercado endereçável real. Aqui aplico filtros honestos de **willingness-to-pay** por segmento.

| Métrica | Valor v1 (otimista) | Valor v2 (honesto) | Justificativa correção |
|---|---|---|---|
| **TAM** total | R$ 252M | **R$ 60M** | Nem toda corretora paga R$ 6k. Tickets reais por porte. |
| **SAM** acessível | R$ 76M | **R$ 18M** | Só ~30-50% por porte pagam SaaS (resto fica em Excel) |
| **SOM** 3 anos | R$ 7,6M | **R$ 1,8M** | 10% do SAM real em 3 anos — ainda agressivo |

### Segmentação realista (com taxa de adoção honesta)

| Segmento | # corretoras | Ticket médio | % que paga SaaS | Mercado real |
|---|---|---|---|---|
| Micro (1-3 func) | 700 | R$ 297/mês | 10% | R$ 250k |
| Pequena (3-10 func) | 1.500 | R$ 697/mês | 30% | R$ 3,8M |
| Média (10-50 func) | 1.000 | R$ 1.997/mês | 45% | R$ 10,8M |
| Grande (>50 func) | 300 | R$ 5.997/mês | 60% | R$ 13M |
| **Total acessível** | **3.500** | — | — | **R$ 27,9M** |

A `% que paga SaaS` reflete que muitas corretoras (especialmente micro/pequenas) operam em Excel + WhatsApp e **não pagam software** — não é só questão de preço, é cultural.

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

### Unit economics (recalibrado v2 — premissas BR realistas)

| Métrica | Valor v1 (otimista) | Valor v2 (honesto) | Notas |
|---|---|---|---|
| ARPU médio | R$ 1.567 | R$ 1.480 | mix mais Starter no início |
| Churn mensal | 4% | **10%** | SaaS B2B BR ano 1 é alto. Cai pra 6-7% no ano 2-3 |
| Lifecycle (1/churn) | 25 meses | **10 meses** | LTV reduzido proporcionalmente |
| LTV | R$ 39.175 | **R$ 14.800** | conservador |
| CAC blended | R$ 1.000 | **R$ 3.500** | agro tem ciclo longo, decisor 50-65 anos |
| **LTV/CAC** | **39x** | **4,2x** | ainda saudável (>3x é OK) |
| Payback period | <1 mês | **2,4 meses** | razoável |
| Gross margin | 78% | 75-80% | inalterado (verdade SaaS) |
| Net margin ano 1 | 50% | **-10% a +20%** | ano 1 é investimento, não lucro |

**Por que CAC mais alto?**
- Decisor agro: dono da corretora, 50-65 anos, conservador
- Ciclo de venda: 30-90 dias (demo presencial frequente)
- Resistência cultural: "sempre funcionou no Excel"
- Inbound qualificado real custa R$ 3-5k; outbound LinkedIn R$ 6-10k

**Por que churn maior?**
- Implementação leva tempo → cliente não vê valor imediato
- Cancelamento sazonal (entressafra reduz uso)
- Concorrência de Excel grátis sempre presente
- Primeiros 12 meses sempre piores (sem case de sucesso interno)

---

## 6. Cenários financeiros — 12 meses (recalibrado v2)

### Premissas comuns (v2 honestas)
- **Churn mensal**: 10% (SaaS B2B BR ano 1)
- **Lifecycle**: 10 meses
- **CAC blended**: R$ 3.500
- **Add-ons**: 5-10% MRR (em vez de 20-30% — corretoras não compram add-ons cedo)
- **Custos operacionais**: infra R$ 2k/mês + Stripe 4% + LLM R$ 500-2k/mês + equipe (variável)
- **Reinvestimento**: 60-80% do gross profit volta pra crescimento (não margem alta no ano 1)

### Cenário 🔴 MUITO RUIM (15% prob)

| | M6 | M12 |
|---|---|---|
| Clientes ativos | 4 | 6 |
| MRR | R$ 5.500 | R$ 8.500 |
| **ARR** | — | **R$ 102k** |
| EBITDA | -R$ 60k | **-R$ 80k** |

**Outcome**: queima caixa, considera pivot ou venda do código.

### Cenário 🟠 RUIM (25% prob)

| | M6 | M12 |
|---|---|---|
| Clientes ativos | 10 | 18 |
| MRR | R$ 14.000 | R$ 26.500 |
| **ARR** | — | **R$ 318k** |
| EBITDA | -R$ 40k | **-R$ 20k** |

**Outcome**: sobrevive operando sozinho + 1 freela. Decide se continua ou volta a job.

### Cenário 🟡 NORMAL — base case (40% prob)

| | M6 | M12 |
|---|---|---|
| Clientes ativos | 20 | 38 |
| MRR | R$ 28.000 | R$ 56.500 |
| Add-ons (~7%) | R$ 2.000 | R$ 4.000 |
| **MRR total** | R$ 30.000 | R$ 60.500 |
| **ARR** | — | **R$ 678k** |
| EBITDA | -R$ 30k | **R$ 80-150k** |

**Outcome**: 1 vendedor + você + 1 dev pleno. Lucrativo no Q4. Decide se capta ou bootstrappa.
**Valuation**: R$ 2-3,5M (3-5x ARR).

### Cenário 🟢 MUITO BOM (15% prob)

| | M6 | M12 |
|---|---|---|
| Clientes ativos | 35 | 78 |
| MRR | R$ 49.000 | R$ 115.000 |
| Add-ons (~10%) | R$ 5.000 | R$ 12.000 |
| **MRR total** | R$ 54.000 | R$ 127.000 |
| **ARR** | — | **R$ 1,38M** |
| EBITDA | -R$ 50k | **R$ 280k** |

**Outcome**: equipe 5-6 pessoas, captação seed possível, PMF claro.
**Valuation**: R$ 5-7M.

### Cenário 🟣 EXCELENTE (5% prob)

| | M6 | M12 |
|---|---|---|
| Clientes ativos | 60 | 150 |
| MRR | R$ 90.000 | R$ 235.000 |
| Add-ons (~12%) | R$ 11.000 | R$ 28.000 |
| **MRR total** | R$ 101.000 | R$ 263.000 |
| **ARR** | — | **R$ 2,82M** |
| EBITDA | R$ 50k | **R$ 850k** |

**Outcome**: captação Series A possível ano 2, time 10-12, expansão vertical.
**Valuation**: R$ 12-18M (4-6x ARR).

### Resumo ponderado v2 — honesto

| | v1 (otimista) | v2 (honesto) | Δ |
|---|---|---|---|
| **Expected ARR ano 1** | R$ 3,2M | **R$ 805k** | **-75%** |
| **Expected EBITDA ano 1** | R$ 1,5M | **R$ 90k** | **-94%** |
| **Expected valuation ano 1** | R$ 14-22M | **R$ 3,5-5M** | **-70%** |
| **Expected clientes ano 1** | 118 | **38** | **-68%** |

**Leitura honesta**: o produto vale a pena, o mercado existe, mas é uma maratona de 3-5 anos, não sprint de 12 meses. Quem promete R$ 2M+ ARR no ano 1 em SaaS B2B agro está vendendo sonho.

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

## 11. Asks (se buscando captação) — recalibrado v2

### Pre-seed / Bootstrap (Q1-Q2 2026) — viável sem captação

Você não precisa captar ainda. Cenário base (R$ 678k ARR ano 1) sustenta operação enxuta:
- Você + 1 vendedor (R$ 6k base + comissão)
- 1 dev pleno (R$ 12k)
- Infra R$ 2k/mês
- Marketing R$ 5-10k/mês
- **Burn rate**: ~R$ 30-40k/mês
- **Receita Q4**: ~R$ 60k/mês → break-even em ~12 meses

**Recomendado**: bootstrappar até atingir MRR R$ 50k antes de captar.

### Seed Round — R$ 1,5-2M (target Q4 2026 ou Q1 2027)

**Quando captar**: depois de 30+ clientes pagantes e MRR R$ 50k+.

**Uso dos recursos (R$ 1,5M scenario)**:
- 50% Equipe (3 hires: 1 vendedor sênior, 1 CS, 1 dev) — R$ 750k
- 30% Marketing & vendas (feiras, tráfego, conteúdo) — R$ 450k
- 10% Produto & infra — R$ 150k
- 10% Reserva 6 meses — R$ 150k

**Estrutura realista 2026**: SAFE ou equity **20-25%** (valuation R$ 6-8M post-money, **não** R$ 15-20M como v1 sugeria).

**Por que valuation mais baixo**:
- Mercado VC 2025/2026 está em down round (vs 2021)
- SaaS B2B seed BR: 3-5x ARR é o padrão (não 8-10x)
- Sem PMF comprovado pré-captação = desconto adicional
- Vertical agro tem menos investidores especializados que SaaS horizontal

**Investidores-alvo (ranking realista)**:
1. **Angels do agro** (donos de cooperativas, traders) — mais provável fechar
2. **SP Ventures** (agro tech, ticket R$ 1-3M)
3. **Barn Investimentos** (agro tech)
4. **Aberto Capital** (early stage BR)
5. **Wayra** (corporate VC, tickets menores)

### Métricas que destravam captação (honesto)

| Métrica | v1 (otimista) | v2 (realista) |
|---|---|---|
| Clientes pagantes | 30+ | **50+** |
| MRR | R$ 50k | **R$ 80-100k** |
| Net retention | 110% | **95-105%** (110% é raro ano 1) |
| Churn mensal | <5% | **<8%** |
| NPS | >50 | **>40** |
| Crescimento MoM | 20% | **15-25%** |
| LTV/CAC | 5x+ | **3x+** |

**Realidade**: muito provável que você só consiga captar no **ano 2** (Q2-Q3 2027) quando tiver 60-100 clientes e MRR R$ 100-150k.

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
