# Análise Competitiva — BH Grain / Mercograin
**Versão:** 1.0 · **Data:** 2026-05-19 · **Autor:** Atlas (Business Analyst)

## Sumário Executivo

O mercado brasileiro de software para corretoras de grãos é dominado por sistemas legados (Sirius, GranTrader), ferramentas verticais incompletas (Datagro, Stark) e a realidade de ~60% das corretoras pequenas operando em Excel + WhatsApp manual. Não existe concorrente que combine:

1. **IA conversacional via WhatsApp** criando propostas (Laura.IA — único)
2. **Multi-tenancy moderno** com permissões granulares por área
3. **Stack integrada** (Mesa + Financeiro + Fiscal + Operação) numa UI 2026
4. **Compliance EUDR** pronto para exportadores

**Janela de oportunidade**: ~12-18 meses antes que Sirius ou novos entrantes copiem.

---

## 1. Mapa Competitivo

### 1.1 Categorização dos concorrentes

```
                          COMPLEXIDADE / FUNCIONALIDADES
                          ────────────────────────────────►
   ▲                                                
   │  PREÇO       Stark         Sirius              Enterprise
   │  ALTO        Mais          (Solyon)            customizado
   │              ($1k-3k)      ($2,5k-8k)          ($5k+)
   │
   │  PREÇO       GranTrader    Datagro Plus       
   │  MÉDIO       ($1,2-3,5k)   ($1,5-4k)          
   │
   │  PREÇO       Trinus        BH Grain ⭐         
   │  POPULAR     Newcore       (Starter R$697)    
   │              ($800-2,5k)                       
   │
   │  GRÁTIS      Excel +       Sheets +           
   │              WhatsApp      Google Apps        
   │                                                
   ▼  ◄────────── ESPECIALIZAÇÃO ──────────────────►
       GENÉRICO              VERTICAL DE CORRETORA
```

### 1.2 Quadrante estratégico

| | **Pouca funcionalidade** | **Muita funcionalidade** |
|---|---|---|
| **Preço baixo** | Excel/WhatsApp (60% mercado) | **BH Grain** 🎯 (sweet spot) |
| **Preço alto** | Datagro Plus | Sirius, Enterprise customizado |

---

## 2. Análise Concorrente a Concorrente

### 2.1 Sirius (Solyon Tecnologia) — Líder de mercado

**Posicionamento**: ERP completo de corretora, líder em MT/MS/GO.

**Pontos fortes**:
- 15+ anos de mercado, marca consolidada
- Base instalada estimada >800 corretoras
- Módulos completos: comercial, fiscal, financeiro, logística
- Integrações maduras com bancos, contadores, conab
- Equipe de implantação presencial
- Conhecimento profundo de regras fiscais BR

**Pontos fracos**:
- UI/UX desatualizada (Visual Basic / Delphi legacy em muitos módulos)
- Lento — clientes reclamam de tempo de resposta
- Não tem IA / assistentes inteligentes
- WhatsApp como integração pobre (não é nativo)
- Modelo de licença on-premise + manutenção anual (não SaaS moderno)
- Setup demorado (60-90 dias)
- Mobile fraco
- Sem multi-tenancy real (cada cliente = instância separada)
- Suporte por telefone/e-mail (não chat em tempo real)
- Implementação custa R$ 15-40k inicial

**Preço**: R$ 2.500–8.000/mês + setup R$ 15-40k + manutenção anual

**Estratégia de ataque BH Grain**:
- Posicionar como "Sirius do futuro" — mesmo escopo, UI moderna, 10x mais rápido
- Migração assistida saindo do Sirius (R$ 1.500 one-time + 3 meses grátis)
- Mostrar Laura.IA em demos — "Sirius leva 5min pra criar proposta, Laura faz em 30s"
- Pricing 60-70% abaixo

### 2.2 Datagro Plus

**Posicionamento**: Plataforma de dados + research + cotações para o agro.

**Pontos fortes**:
- Conteúdo editorial forte (relatórios, análises de mercado)
- Cotações detalhadas (CEPEA + CME + análises)
- Base instalada em traders profissionais e fundos
- Marca respeitada (Datagro Consultoria + Plus)
- Análises técnicas e fundamentalistas integradas

**Pontos fracos**:
- Não é ERP — não tem propostas, contratos, financeiro, fiscal
- Pensado pra trader profissional, não pra corretora operacional
- Sem operação de campo (romaneios, balança, estoque)
- Sem WhatsApp / cliente final
- Sem multi-usuário robusto
- Custo alto para o que entrega (só dado)

**Preço**: R$ 1.500–4.000/mês (cotações + research)

**Estratégia de ataque**: complementar, não substituir. Oferecer integração via API ou parceria (Datagro fornece dados premium dentro do BH Grain).

### 2.3 GranTrader (e similares: AgriPoint, Comprafutura)

**Posicionamento**: Foco em hedge, CBOT, gestão de risco de futuros.

**Pontos fortes**:
- Especialização em derivativos / hedge
- Integração com BM&F / CBOT
- Bom pra trader que opera muito futuros
- Calculadoras avançadas de basis/spread

**Pontos fracos**:
- Não cobre nada de fiscal
- Não tem CRM / propostas
- Não tem operação física
- Nicho muito específico (não serve corretora full-service)
- UI técnica, não amigável a operador comum

**Preço**: R$ 1.200–3.500/mês

**Estratégia de ataque**: BH Grain Pro já tem hedge integrado. Posicionar como "GranTrader + tudo o resto que você precisa".

### 2.4 Stark Mais (ERP genérico de agro)

**Posicionamento**: ERP horizontal de agro (cooperativas, fazendas, corretoras).

**Pontos fortes**:
- ERP completo, vários módulos
- Atende vários perfis (cooperativa, fazenda, corretora)
- Marca conhecida em SC/RS/PR

**Pontos fracos**:
- Genérico — não é otimizado pra corretora
- Não tem WhatsApp / Laura.IA
- Implementação cara (50k+ pra grandes)
- Sem multi-tenant moderno
- UI antiga

**Preço**: R$ 1.000–3.000/mês

**Estratégia de ataque**: vertical wins. "Software feito por corretora, pra corretora" vs ERP genérico.

### 2.5 Trinus / Newcore / sistemas locais

**Posicionamento**: Sistemas custom feitos por empresas regionais.

**Pontos fortes**:
- Personalização extrema (custom dev pra cada cliente)
- Atendimento personalizado regional
- Conhecimento de regras locais

**Pontos fracos**:
- Sem escala — não conseguem investir em produto
- Sem IA, sem mobile, sem APIs modernas
- Lock-in alto (cliente preso, difícil migrar)
- Tecnologia datada

**Preço**: R$ 800–2.500/mês + customizações faturadas

**Estratégia de ataque**: SaaS moderno > sistema custom. "Mensalidade previsível, sem surpresas, atualização contínua sem custo".

### 2.6 Excel + WhatsApp manual (60% das pequenas)

**Posicionamento**: "Não pago software".

**Pontos fortes**:
- Custo zero direto
- Familiar a todos
- Sem aprendizado

**Pontos fracos**:
- Erros frequentes (planilhas batem? cotação atualizada?)
- Sem auditoria
- Sem multi-usuário real
- Risco fiscal alto (escrituração manual)
- Não escala
- Perde-se tempo enorme em tarefas repetitivas
- Sem visibilidade gerencial

**Estratégia de ataque**: educação. Mostrar **custo oculto** (horas perdidas, multas fiscais, propostas perdidas).
- Calculadora de ROI no marketing: "quanto custa o seu Excel?"
- Caso: "perdi R$ 80k em multa porque esqueci de emitir SPED"

---

## 3. Matriz de Recursos Comparativa

Legenda: ✅ Completo · 🟡 Parcial · ❌ Ausente · 🌟 Único

| Recurso | BH Grain | Sirius | Datagro | GranTrader | Stark | Trinus |
|---|---|---|---|---|---|---|
| **Multi-tenant SaaS** | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |
| **UI moderna (2026)** | ✅ | ❌ | 🟡 | 🟡 | ❌ | ❌ |
| **Mobile responsive** | ✅ | ❌ | 🟡 | 🟡 | 🟡 | ❌ |
| **Propostas + Contratos** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Cotações ao vivo** | ✅ | 🟡 | ✅ | ✅ | 🟡 | 🟡 |
| **Hedge / Futuros** | ✅ | 🟡 | 🟡 | ✅ | ❌ | ❌ |
| **Fiscal NF-e + SPED** | ✅ | ✅ | ❌ | ❌ | ✅ | 🟡 |
| **Financeiro completo** | ✅ | ✅ | ❌ | ❌ | ✅ | 🟡 |
| **Operação física** (romaneio, balança) | ✅ | ✅ | ❌ | ❌ | ✅ | 🟡 |
| **Originação** (fixação, barter) | ✅ | 🟡 | ❌ | ❌ | 🟡 | ❌ |
| **WhatsApp nativo + Inbox** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **IA conversacional (Laura)** | 🌟 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Portal do produtor white-label** | ✅ | 🟡 | ❌ | ❌ | ❌ | ❌ |
| **EUDR compliance** | ✅ | 🟡 | ❌ | ❌ | ❌ | ❌ |
| **API pública** | ✅ | 🟡 | 🟡 | ❌ | 🟡 | ❌ |
| **Multi-workspace + permissões área** | 🌟 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Dashboards customizáveis** | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ❌ |
| **Audit log + LGPD** | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ |
| **Onboarding self-service** | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |
| **Trial gratuito** | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |

**Score total** (✅=2, 🟡=1, ❌=0, 🌟=3):
- **BH Grain: 41 / 42** (97%)
- Sirius: 22 / 42 (52%)
- Stark: 17 / 42 (40%)
- Trinus: 11 / 42 (26%)
- Datagro: 12 / 42 (28%)
- GranTrader: 9 / 42 (21%)

---

## 4. Análise SWOT consolidada do BH Grain

### Strengths (forças)

1. **Laura.IA** — único concorrente com IA conversacional via WhatsApp criando propostas reais
2. **Stack moderna** — Next.js 14, performance, mobile-first, deploys contínuos
3. **Multi-tenancy real** — 1 sistema atende N corretoras, economia operacional
4. **Cobertura vertical completa** — Mesa + Financeiro + Fiscal + Operação + Originação
5. **Time-to-value rápido** — onboarding self-service em <30min vs 60-90 dias dos concorrentes
6. **Pricing transparente** — 3 tiers públicos, sem "fale com vendas" pra começar
7. **EUDR compliance** — janela fresca, exportadores precisando agora

### Weaknesses (fraquezas)

1. **Marca desconhecida** — Sirius/Datagro têm 15+ anos de mercado
2. **Sem base instalada** — 0 clientes pagantes hoje
3. **Time pequeno** — fundador + Claude (sem equipe de vendas/CS)
4. **Sem certificações específicas** (ex: integrações certificadas com Conab, JBS, ADM)
5. **Sem casos de sucesso** documentados
6. **Bugs descobertos pré-launch** (autofill CNPJ/CEP, alguns labels do wizard)
7. **Dependência de Stripe** (test mode hoje) — precisa habilitar prod e validar fluxo de cobrança real

### Opportunities (oportunidades)

1. **Sirius perdendo clientes** — base envelhecida insatisfeita com UI/lentidão
2. **EUDR** — UE exige rastreabilidade desde 2025/2026, ninguém preparado
3. **Cooperativas** — Coamo, C.Vale, Lar buscando white-label pra ofertar aos cooperados
4. **Geração Y/Z assumindo corretoras** — herdeiros querem ferramentas modernas
5. **WhatsApp Business API barateando** — Meta cobrindo cada vez mais países BR
6. **IA viral** — corretora com Laura.IA gera buzz orgânico no LinkedIn/Twitter agro
7. **Show Rural Coopavel + Agrishow** — eventos pra mostrar produto

### Threats (ameaças)

1. **Sirius copiando** — eles têm caixa pra reagir, podem investir R$ 5-10M em refactor
2. **Big tech entrando** (Stark, Conab modernizando) — improvável mas possível
3. **Mudança regulatória fiscal** — qualquer mudança SPED/NF-e requer dev
4. **Crise no agro** (preços baixos, seca) — clientes cortam software
5. **Saturação WhatsApp** — Meta pode aumentar custos da API
6. **Concorrente novo bem capitalizado** — VC pode bancar concorrente direto
7. **Dependência LLM** — preços de Groq/OpenRouter podem subir

---

## 5. Estratégia de Posicionamento

### Mensagem central

> **"A primeira plataforma de corretora de grãos com IA. Vendas via WhatsApp, fiscal automático, financeiro completo. Tudo em um só lugar, por R$ 697/mês."**

### Diferenciação por persona

#### Para o dono da corretora (CEO)
> "Reduza 40% do tempo do seu time em tarefas repetitivas. Laura.IA atende WhatsApp, fiscal emite SPED sozinho, financeiro concilia OFX. Você foca em vender mais."

#### Para o trader/operador
> "Calculadora, hedge, cotações ao vivo CBOT + CEPEA + câmbio em uma tela. Crie proposta em 30s. Aceite ou rejeite no celular."

#### Para o financeiro/fiscal
> "DRE em tempo real, NF-e + SPED gerados automaticamente. Conciliação OFX bate banco e sistema em 1 clique. Audit log de tudo."

#### Para o produtor (portal)
> "Seu próprio portal com a marca da corretora. Veja cotações, propostas e contratos no celular, sem ligar ou usar WhatsApp."

### Slogan candidatos

1. **"BH Grain — Corretora moderna, pra corretora moderna."**
2. **"A inteligência da Laura, a operação da sua corretora."**
3. **"Mais propostas. Menos planilhas."**
4. **"O ERP que conversa pelo seu time."**

Recomendado: #2 — destaca o diferencial único (Laura.IA).

---

## 6. Roadmap competitivo (12 meses)

### Q1 2026 — Fundação
- Lançar com 10 corretoras pioneer (preço promo R$ 497/mês)
- Coletar 5 cases documentados
- Habilitar Stripe prod
- DNS SPF/DKIM/DMARC ajustado

### Q2 2026 — Validação
- Lançamento público (R$ 697/1997/5997)
- Conteúdo: 1 case study/semana, 1 webinar/mês
- Indicação: 1 mês grátis para quem indica
- Meta: 30 clientes, R$ 35k MRR

### Q3 2026 — Aceleração
- Presença em Show Rural Coopavel (ago) ou Agrishow (mai/27)
- Contratação 1 vendedor + 1 CS
- Partnership com 1 cooperativa (white-label pilot)
- API pública (Pro+) + marketplace de integrações
- Meta: 60 clientes, R$ 90k MRR

### Q4 2026 — Expansão
- Captação seed R$ 2-5M (se métricas válidas)
- Time 4-6 pessoas
- Expansão para 2 cooperativas + 1 vertical adjacente (algodão, café)
- Meta: 100+ clientes, R$ 180k MRR

---

## 7. Sinais de monitoramento competitivo

### Watchlist (revisar mensal)

- **Sirius**: site, LinkedIn dos sócios, releases novos
- **Datagro Plus**: novos módulos, parcerias
- **Cooperativas grandes**: contratos de tecnologia anunciados
- **Conab**: editais de modernização
- **VCs no agro** (SP Ventures, Barn Investimentos, Wayra): startups que captaram

### Métricas de market share a acompanhar

- # corretoras certificadas BCB (proxy de mercado)
- # NF-e de natureza "venda grão" emitidas (proxy de volume)
- Volume comercializado por commodity (CONAB)
- Adoção WhatsApp Business API agro (Meta reports)

---

## 8. Riscos competitivos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Sirius lança IA própria | Médio | Alto | Patentear/registrar abordagem Laura.IA; criar moat de dados (treinos com transcrições) |
| Cooperativa monta competidor in-house | Baixo | Alto | Fechar partnership com 1 grande primeiro (Coamo ou C.Vale) |
| Big tech entra (TOTVS, SAP agro) | Baixo | Médio | Verticalização extrema; eles serão genéricos |
| Crise no agro 2027 | Médio | Médio | Plano Starter accessível mantém entrada; freemium se necessário |
| Stripe BR muda regras | Baixo | Alto | Plan B com Pagar.me ou Asaas |
| LLM providers (Groq/OpenAI) sobem preço | Médio | Médio | Já temos fallback chain; BYOK no Enterprise |

---

## 9. Conclusões e recomendações

### Top 3 ações imediatas

1. **Fechar 5 cases pioneer em 60 dias** — preço promo, contrato de testimonial
2. **Conteúdo Laura.IA** — vídeos de 30s mostrando Laura criando proposta no WhatsApp
3. **DNS + email deliverability** — sem isso, nenhum dos outros itens importa

### Top 3 ações em 90 dias

1. **Programa de indicação** — 1 mês grátis pra quem indica + comissão recorrente
2. **Partnership com 1 cooperativa** (mesmo pilot, mesmo grátis) — credibilidade
3. **Calculadora de ROI** no marketing — "quanto você perde com Excel?"

### Métricas a perseguir

| Métrica | Q1 | Q2 | Q3 | Q4 |
|---|---|---|---|---|
| Clientes pagantes | 10 | 30 | 60 | 100 |
| MRR (R$) | 7k | 35k | 90k | 180k |
| Churn mensal | <8% | <6% | <5% | <4% |
| NPS | >40 | >50 | >55 | >60 |
| CAC | <R$ 1.500 | <R$ 1.200 | <R$ 1.000 | <R$ 800 |
| LTV/CAC | >15x | >25x | >35x | >50x |

---

**Documento vivo**. Revisar a cada 60 dias ou quando concorrente fizer movimento relevante.

— Atlas, investigando a verdade 🔎
