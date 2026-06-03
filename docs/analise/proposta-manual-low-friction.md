# Proposta manual de baixo atrito — Spec executiva

> **Contexto:** Cliente liga, operador cadastra proposta. Hoje o form `/propostas/nova` é otimizado para digitação visual (15+ campos, scroll), não para o cenário telefone+memória curta. Esta spec define a evolução para **command-bar + voz + quick-create cliente inline**, reutilizando 80% do código existente.
>
> **Decisão de stack:** local/grátis. Sem APIs pagas de transcrição. Web Speech API (browser nativo) + parser regex já existente.
>
> **Data:** 2026-06-03 · **Autor:** Orion (aios-master)

---

## 1. Problema

Operador no telefone (ou revisando gravação) precisa cadastrar proposta. Atrito atual:

| # | Atrito | Custo |
|---|--------|-------|
| 1 | Carrega lista de 200 clientes, scrolla pra achar | 5–15 s por proposta |
| 2 | Cliente novo? Pausa ligação, sai pra `/clientes/novo`, volta | 60–120 s + risco perder cliente |
| 3 | Cliente fala "mil sacas de soja a 130 a saca", operador traduz mentalmente em 6 campos | 20–40 s + erros de unidade |
| 4 | Validade, descrição, tipo — 4 cliques + scroll | 10 s |
| 5 | Após salvar: precisa entrar no detalhe, baixar PDF, abrir WhatsApp, anexar | 30–60 s |
| 6 | Pós-call: operador lembra de cabeça e digita 5 min depois | erros de memória |

**Total atual:** ~3–5 min por proposta + ~5% de erro (preço/quantidade/unidade trocadas).

**Meta:** ~45 s por proposta digitada, ~15 s por proposta ditada, < 1% de erro.

---

## 2. Inventário do que já existe (não recriar)

Confirmado via mapeamento do codebase (Explore agent):

| Capacidade | Onde | Estado |
|------------|------|--------|
| `POST /api/propostas` com geração automática de número | `app/api/propostas/route.ts:114` | ✅ pronto |
| Lookup CNPJ → BrasilAPI + ReceitaWS + cache 24h | `app/api/br/cnpj/[cnpj]/route.ts` + `lib/br/receitaws.ts` | ✅ pronto |
| Parser agro (regex commodity + quantidade) | `lib/bhgrain/ai-classifier.ts:60-104` | ✅ pronto — só falta expor |
| Conversões de unidade (t / sc60 / kg / R$/t / R$/sc / US$/bu) | `lib/cotacoes/unidades.ts` | ✅ pronto |
| Câmbio USDBRL em tempo real | `/api/bhgrain/cbot` | ✅ pronto |
| Margem default por commodity | `/api/bhgrain/margins` | ✅ pronto |
| Geração de PDF de proposta | `lib/pdf-service.ts` + `GET /api/propostas/[id]/pdf` | ✅ pronto |
| Envio de proposta (rascunho → enviada) | `POST /api/bhgrain/propostas/[id]/enviar` | ✅ pronto (mas não dispara WhatsApp) |
| Schema com canalAutorizacao `'telefone'` | `prisma/schema.prisma:879` | ✅ pronto |
| Form `/clientes/novo` com CNPJ auto-preenche | `app/clientes/novo/page.tsx` | ✅ pronto (página standalone) |

**O que falta construir:**

| Lacuna | Solução |
|--------|---------|
| Modal inline de criar cliente dentro do flow de proposta | Extrair `ClienteForm` do `/clientes/novo` em componente reutilizável + modal |
| Command-bar para entrada por texto livre | `cmdk` + parser existente + preview ao vivo |
| Captura de voz com transcrição PT-BR | Web Speech API (`window.SpeechRecognition`) com fallback gracioso |
| Envio WhatsApp 1-clique pós-criação | Link público assinado do PDF + `wa.me/{telefone}?text=...` |
| Quick-finalize: criar + enviar + WhatsApp em uma ação | Endpoint composto ou orquestração client-side |

---

## 3. Arquitetura proposta — 3 modos de entrada coexistindo

### Modo A — Command bar (digitação rápida durante ligação)

Página: `/propostas/nova` ganha uma **command-bar no topo** (sempre focada ao carregar).

```
┌─────────────────────────────────────────────────────────┐
│ ⌘  Fazenda São João · 1000sc soja 130/sc 30d Sorriso ▎ │
└─────────────────────────────────────────────────────────┘
   ↓ parse em tempo real
┌─────────────────────────────────────────────────────────┐
│ Cliente: Fazenda São João  ✓ encontrado (CNPJ 12.345…)  │
│ Grão: soja · 60 t (1000 sc 60kg)                        │
│ Preço: R$ 2.166,67/t (R$ 130/sc)                        │
│ Validade: 03/07/2026 (+30 dias)                          │
│ Local: Sorriso/MT                                        │
│                                                          │
│ Subtotal: R$ 130.000,00 · Margem projetada: R$ 5.200,00 │
│                                                          │
│   [Enter] Criar    [⇧Enter] Criar + enviar WhatsApp     │
└─────────────────────────────────────────────────────────┘
```

**Gramática suportada** (livre, ordem não importa):

| Token | Exemplo | Mapeia para |
|-------|---------|-------------|
| Nome cliente | `Fazenda São João`, `Maria Costa` | Fuzzy search em `Cliente.nome`. Se não achar → oferece `+ Criar "Fazenda São João"` |
| Quantidade | `1000sc`, `60t`, `500 sacas`, `40000kg` | Normaliza para toneladas (reutiliza `qtdParaTon`) |
| Preço | `130/sc`, `2200/t`, `R$ 130 saca`, `13,50/kg` | Normaliza para R$/t (reutiliza `precoParaBrlTon`) |
| Grão | `soja`, `milho`, `trigo`, `algodão`, `café`, `arroz`, `sorgo`, `aveia` | Dicionário em `COMMODITY_PATTERNS` |
| Validade | `30d`, `30 dias`, `15/07`, `até 15/07` | `addDays(now, 30)` ou parse de data |
| Local | `Sorriso`, `Sorriso/MT`, `em Cascavel` | `Proposta.origem` ou `localEntrega` |
| Tipo | `compra`, `venda`, `comprar`, `vender` | Default `venda`; trocar se detectar |

**Implementação:** parser puro TypeScript em `lib/propostas/parse-comando.ts`. Tem **testes unitários obrigatórios** com casos reais.

### Modo B — Captura por voz (Web Speech API)

Botão de microfone na command-bar. Dois sub-modos:

**B1. Ao vivo (durante ligação)** — operador deixa rodando, ele fala junto com cliente:
- `SpeechRecognition` com `continuous=true`, `interimResults=true`, `lang='pt-BR'`.
- Transcrição interim alimenta a command-bar; parser roda a cada delta debouncado em 300ms.
- Operador revisa, ajusta com teclado, confirma com Enter.

**B2. Pós-call (revisão de gravação)** — operador cola transcrição ou usa botão "ditar":
- Mesma command-bar, mas com textarea expandida.
- Parser roda no blur.

**Compatibilidade:**
- ✅ Chrome/Edge (desktop e Android): full support, pt-BR nativo.
- ✅ Safari (macOS 14+, iOS 14.5+): suporte via `webkitSpeechRecognition`.
- ❌ Firefox: gracefully degrada — esconde botão mic, mantém digitação.
- ❌ Modo offline: idem.

**Fallback explícito:** se `'SpeechRecognition' in window === false && 'webkitSpeechRecognition' in window === false`, botão de mic não renderiza.

### Modo C — Form clássico (compatibilidade)

O form atual continua funcionando, mas vira **expansor opcional** abaixo da command-bar:
`[ ⌄ Editar campos avançados ]` — abre o form completo (logística, qualidade, atribuição comercial).

Garante que campos opcionais (origem, destino, frete, qualidade, gerente) ainda sejam acessíveis sem regressão.

---

## 4. Quick-create cliente inline

**Atrito #1 eliminado.** Quando a command-bar detecta nome de cliente que não existe na base:

```
Cliente: "Fazenda São João" — não encontrado
  ┌────────────────────────────────────────┐
  │ + Criar cliente "Fazenda São João"     │  ← Tab para focar
  └────────────────────────────────────────┘
```

Ao confirmar (Tab + Enter), abre **modal** (não navegação) com:

1. Campo CNPJ no topo. Ao colar/digitar → `onBlur` chama `/api/br/cnpj/{cnpj}` (já existe), auto-preenche tudo.
2. Nome (pré-preenchido pelo que foi digitado na command-bar).
3. Telefone, email, cidade/UF.
4. Tipo: comprador / vendedor / ambos (default: ambos).
5. `[Criar e continuar]` → `POST /api/clientes`, fecha modal, injeta `clienteId` na command-bar, foca de volta.

**Componente:** extrair lógica do `app/clientes/novo/page.tsx` em `components/ClienteForm.tsx` reutilizável. A página standalone passa a usar o mesmo componente.

---

## 5. Quick-finalize: criar + enviar + WhatsApp

Pós-criação, oferecer **três ações de fechamento** no Card de sucesso:

| Ação | Atalho | O que faz |
|------|--------|-----------|
| Concluir | `Enter` | Volta pra lista `/propostas` |
| Enviar | `E` | `POST /api/bhgrain/propostas/{id}/enviar` (já existe) + volta pra lista |
| Enviar + WhatsApp | `W` | Idem acima + gera link público assinado do PDF + abre `https://wa.me/{telefone}?text=...` em nova aba com mensagem pré-formatada |

**Link público do PDF:**
- Novo endpoint `GET /api/propostas/{id}/share/{token}` que aceita token JWT assinado com TTL = `validadeEm` da proposta.
- Sem autenticação (token é a credencial). Retorna PDF.
- Token gerado em `POST /api/propostas/{id}/share` (auth normal).
- Log de acesso registra IP + UA para audit.

**Mensagem WhatsApp template:**
```
Olá {nomeCliente}! Segue a proposta {numero} da {workspace}:

• {grao}: {quantidade}t a R$ {preco}/t = R$ {subtotal}
• Validade: até {validade}

PDF: {linkPublico}

Qualquer dúvida estou à disposição.
```

---

## 6. Schema — campos que ganham preenchimento automático

Sem alterar schema. Apenas API populando mais campos:

| Campo | Valor automático no modo command-bar |
|-------|---------------------------------------|
| `canalAutorizacao` | `'telefone'` (era `'web'`) |
| `origem` ou `localEntrega` | parseado da command-bar |
| `validadeCotacao` | igual a `validadeEm` |
| `marketPriceAtCreation` | snapshot do `/api/bhgrain/cbot` no momento da criação |
| `cotacaoCapturadaEm` | `new Date()` |
| `gerenteContaId` / `vendedorId` | já preenchidos automaticamente hoje |

Logística detalhada, qualidade e armazéns ficam no expansor "Editar campos avançados" — não bloqueiam a criação rápida.

---

## 7. Métricas de sucesso

| Métrica | Baseline | Meta após M1 | Como medir |
|---------|----------|--------------|------------|
| Tempo médio de criação de proposta | 3–5 min | < 45 s digitada / < 15 s ditada | Log de `criadaEm - sessaoIniciadaEm` |
| Taxa de erro pós-criação (proposta editada/cancelada < 5 min) | ~5% | < 1% | Query em `atualizadaEm - criadaEm < 5min AND status='cancelada'` |
| % propostas criadas via command-bar vs form clássico | 0% | > 70% | Tag em `Proposta` (campo `criadaVia: 'command-bar' \| 'form' \| 'voz'` — opcional, JSON em observacoes ou metadata) |
| % propostas com cliente novo criado inline | 0% | > 90% dos casos de cliente novo | Log de modal de criação |

---

## 8. Roadmap — 3 milestones

### M1 — Command-bar + Quick-create cliente (4–6h dev)
- Parser `lib/propostas/parse-comando.ts` + testes
- Componente `<PropostaCommandBar />` com `cmdk`
- `<ClienteFormModal />` extraído de `/clientes/novo`
- Preview ao vivo (cliente, grão, preço, subtotal, margem)
- Atalhos: Enter (criar), Shift+Enter (criar+enviar), Esc (limpa)
- API: aceita `canalAutorizacao: 'telefone'`, popula campos automáticos
- Form clássico vira expansor abaixo

### M2 — Voz Web Speech API (2–3h dev)
- Componente `<MicButton />` com Web Speech API
- Detecção de suporte + fallback gracioso
- Alimenta transcrição interim na command-bar
- Indicador visual de "ouvindo" (waveform CSS simples)
- Sub-modo pós-call: textarea expandida + parse on-blur

### M3 — Quick-finalize WhatsApp (2–3h dev)
- Endpoint `POST/GET /api/propostas/{id}/share` com token JWT
- Botão "Enviar + WhatsApp" pós-criação
- Template de mensagem
- Log de acesso ao link público
- Gancho para o **portal do cliente** (próximo épico): link público pode forçar login se cliente já tiver conta no portal

---

## 9. Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Parser falha em ordem rara ("a 130 mil sacas soja") | média | Preview sempre visível — operador vê erro antes de salvar. Testes com 30+ casos reais coletados em sessão com operador. |
| Web Speech API ruim em ambiente barulhento | alta | Botão de toggle, transcrição sempre editável, modo digitação preservado. |
| Link público de PDF vazado | baixa | Token JWT com TTL = validade + audit log + revogação manual. |
| Conflito de número de proposta em race condition | baixa | Já mitigado por `nextNumber()` com lock. |
| Cliente novo criado por engano (operador errou nome) | média | Botão "Desfazer criação" no toast de sucesso (TTL 30s). |

---

## 10. Fora de escopo (deste ciclo)

- ❌ Integração com central telefônica (Twilio, ZenviaCall) — Web Speech roda no browser, suficiente.
- ❌ Transcrição de gravações antigas em lote — pós-call já cobre.
- ❌ IA generativa para sugerir contra-proposta — fica para depois do portal do cliente.
- ❌ Portal do cliente — épico separado, este só prepara o link público.

---

## Referências externas

- [Web Speech API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [cmdk — pacote](https://cmdk.paco.me/)
- Mapeamento interno do código (Explore agent, 2026-06-03)
