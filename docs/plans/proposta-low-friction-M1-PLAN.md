# PLAN.md — Proposta Manual Low-Friction · Milestone 1

> **Escopo M1:** Command-bar + parser + quick-create cliente inline + populamento automático de canal.
> **Não inclui:** voz (M2), WhatsApp pós-criação (M3).
> **Spec de referência:** [`docs/analise/proposta-manual-low-friction.md`](../analise/proposta-manual-low-friction.md)
> **Estimativa:** 4–6h de implementação efetiva.

---

## Pré-requisitos

- [ ] Spec lida e aprovada
- [ ] `cmdk` instalado: `pnpm add cmdk` (ou `npm install cmdk`)
- [ ] Branch criada: `feat/proposta-command-bar`

---

## Task 1 — Parser de comando (puro, testável)

**Arquivo:** `lib/propostas/parse-comando.ts`

**Contrato:**
```ts
export interface ParsedComando {
  clienteNome?: string         // texto reconhecido como nome
  grao?: GraoKey               // soja | milho | trigo | algodao | cafe | arroz | sorgo | aveia
  quantidadeTon?: number       // canônico
  quantidadeBruta?: { valor: number; unidade: UnidadeQtd }  // como foi digitada
  precoBrlTon?: number         // canônico
  precoBruto?: { valor: number; unidade: UnidadePreco }
  validadeEm?: Date            // absoluta
  validadeRelativa?: number    // dias, se digitou "30d"
  local?: string               // "Sorriso", "Sorriso/MT"
  tipo?: 'venda' | 'compra'    // default venda
  warnings: string[]           // ex: "preço fora da faixa de mercado"
}

export function parseComando(input: string, ctx: ParseContext): ParsedComando
```

**`ParseContext`** carrega: lista de grãos canônicos, câmbio USDBRL, data atual.

**Subtasks:**
- [ ] 1.1. Tokenização: split por espaços preservando `"frase entre aspas"` e números com vírgula.
- [ ] 1.2. Reconhecimento de quantidade: regex `(\d+[.,]?\d*)\s*(t|ton|toneladas?|sc|sacas?|kg)` — reutilizar `COMMODITY_PATTERNS` e `QTY_REGEX` de `lib/bhgrain/ai-classifier.ts`.
- [ ] 1.3. Reconhecimento de preço: regex `(R\$\s*)?(\d+[.,]?\d*)\s*[/]\s*(t|sc|kg|bu)` ou `(R\$\s*)?(\d+[.,]?\d*)\s+(saca|tonelada|kg)`.
- [ ] 1.4. Reconhecimento de grão: dicionário de `COMMODITY_PATTERNS` + fuzzy (Levenshtein ≤ 2).
- [ ] 1.5. Reconhecimento de validade: `\d+\s*d(ias?)?` ou `\d{1,2}/\d{1,2}(/\d{2,4})?`.
- [ ] 1.6. Reconhecimento de local: regex `em\s+([A-ZÁÉÍÓÚ][a-záéíóú]+(?:[/-][A-Z]{2})?)` OU último token capitalizado não consumido.
- [ ] 1.7. Reconhecimento de tipo: keywords `comprar|compra` / `vender|venda` (default `venda`).
- [ ] 1.8. Resto do texto não consumido = candidato a `clienteNome`.
- [ ] 1.9. Conversões de unidade reutilizam `qtdParaTon` / `precoParaBrlTon` (mover esses para `lib/cotacoes/unidades.ts` se ainda estão só no form).
- [ ] 1.10. Warnings: preço >50% acima/abaixo da média de mercado (consultar `marginsMap` se disponível).

**Testes obrigatórios** em `lib/propostas/parse-comando.test.ts`:

```ts
// Casos mínimos
'Fazenda São João 1000sc soja 130/sc 30d Sorriso'
'1000 sacas de soja a 130 reais a saca para Maria Costa entrega em 30 dias'
'compra milho 60t 2200/t Cascavel/PR'
'Coop Alfa 500sc soja R$ 140 saca até 15/07'
'soja 1000sc 130/sc'  // sem cliente → clienteNome undefined
'algodao 50t 14000/t com Fazenda XYZ'
// Edge cases
'1.000 sacas'  // ponto como milhar
'1,5t'         // vírgula como decimal
'R$ 2.166,67/t'
'Cliente do meio nome composto 100t soja 2200/t'
```

**Critério de done:** todos os casos passam, cobertura ≥ 90% das linhas.

---

## Task 2 — Componente ClienteForm reutilizável

**Arquivo:** `components/clientes/ClienteForm.tsx` (novo)

**Subtasks:**
- [ ] 2.1. Extrair JSX e lógica de `app/clientes/novo/page.tsx` em `ClienteForm` com props:
  ```ts
  interface ClienteFormProps {
    initialNome?: string
    initialTipo?: 'comprador' | 'vendedor' | 'ambos'
    onSuccess: (cliente: Cliente) => void
    onCancel?: () => void
    embedded?: boolean  // sem PageHeader/AppShell quando true
  }
  ```
- [ ] 2.2. Manter CNPJ lookup `onBlur` (lógica existente).
- [ ] 2.3. Refatorar `app/clientes/novo/page.tsx` para usar `ClienteForm` — **não pode quebrar** página standalone.
- [ ] 2.4. Smoke test: criar cliente via página standalone ainda funciona idêntico.

---

## Task 3 — Modal de quick-create cliente

**Arquivo:** `components/clientes/ClienteQuickCreateModal.tsx`

**Subtasks:**
- [ ] 3.1. Modal usando primitivos `ui/phb` (verificar se existe `Dialog`; senão usar Radix).
- [ ] 3.2. Recebe `nomeInicial`, callback `onCreated(cliente)`.
- [ ] 3.3. Renderiza `<ClienteForm embedded initialNome={nomeInicial} onSuccess={onCreated} />`.
- [ ] 3.4. Atalho ESC fecha; Enter no último campo submete.

---

## Task 4 — Command-bar

**Arquivo:** `components/propostas/PropostaCommandBar.tsx`

**Subtasks:**
- [ ] 4.1. Instalar `cmdk`.
- [ ] 4.2. Input texto livre, fontSize grande (16px+), monospace opcional.
- [ ] 4.3. Carregar lista de clientes via `/api/clientes?limit=500` (não 200 — operador precisa de cobertura).
- [ ] 4.4. Rodar `parseComando` em cada keystroke, debounce 150ms.
- [ ] 4.5. Renderizar **preview-card abaixo do input**:
  - Cliente: nome + status (✓ encontrado / ⚠ não encontrado + `[Criar]`)
  - Grão: nome + qtd em t (e em sc60 como hint)
  - Preço: R$/t (e R$/sc como hint)
  - Validade: data absoluta (DD/MM/AAAA)
  - Local: se houver
  - Subtotal, margem projetada (reutilizar lógica do form atual)
  - Warnings amarelos
- [ ] 4.6. Detectar cliente não encontrado: fuzzy search em nomes; se score top < 0.6, mostrar opção `[Tab] Criar "Nome"`.
- [ ] 4.7. Atalhos:
  - `Enter` → submete (cria proposta + redireciona pra `/propostas`)
  - `Shift+Enter` → cria proposta e dispara `/api/bhgrain/propostas/{id}/enviar`
  - `Tab` → quando há cliente não encontrado, abre `ClienteQuickCreateModal`
  - `Esc` → limpa input
- [ ] 4.8. Validação inline: bloqueia Enter se faltar cliente, grão, quantidade, preço, validade.
- [ ] 4.9. Botão `⌄ Editar campos avançados` abaixo — expande form clássico.

---

## Task 5 — Integração na página `/propostas/nova`

**Arquivo:** `app/propostas/nova/page.tsx` (refactor)

**Subtasks:**
- [ ] 5.1. Adicionar `<PropostaCommandBar />` no topo do `<AppShell>`.
- [ ] 5.2. Mover form atual para dentro de `<details>` ou `<Collapsible>` com label "Editar campos avançados".
- [ ] 5.3. Estado compartilhado: quando command-bar parseia algo, atualiza state que o form clássico consome. Bi-direcional.
- [ ] 5.4. Quando cliente é criado via modal, injeta no state do form clássico também.

**Não-regressão:** o form clássico continua submetendo via `POST /api/propostas` com o payload atual. Nada quebra.

---

## Task 6 — API: aceitar e popular novos campos

**Arquivo:** `app/api/propostas/route.ts`

**Subtasks:**
- [ ] 6.1. Estender Zod schema para aceitar:
  - `canalAutorizacao?: 'web' | 'whatsapp' | 'telefone' | 'ia_autonomo'` (default `'web'`)
  - `origem?: string`
  - `localEntrega?: string`
- [ ] 6.2. Capturar snapshot de cotação se disponível: chamar `getUltimaCotacao(grao)` para popular `marketPriceAtCreation`, `cotacaoCapturadaEm`, `cotacaoFonte`.
- [ ] 6.3. Default `validadeCotacao = validadeEm` quando não informado.
- [ ] 6.4. Não quebrar payload existente (todos novos campos são opcionais).

---

## Task 7 — Telemetria

**Arquivo:** novo evento em `lib/analytics/events.ts` (ou onde estão eventos)

**Subtasks:**
- [ ] 7.1. Disparar evento `proposta_criada` com props:
  - `via: 'command-bar' | 'form' | 'voz'`
  - `duracaoMs` (desde mount até submit)
  - `clienteCriadoInline: boolean`
  - `editadoApos: number` (preencher depois via evento separado se editada nos primeiros 5 min)
- [ ] 7.2. Disparar `proposta_command_bar_parse_falha` quando parser não consegue extrair campo essencial após 3 keystrokes pausados.

---

## Verificação de done (M1)

- [ ] Testes do parser: `pnpm test lib/propostas/parse-comando.test.ts` — 100% passa.
- [ ] Lint + typecheck: `pnpm lint && pnpm typecheck` — zero erros.
- [ ] **Teste manual obrigatório** (não pode ser pulado — regra do projeto):
  - [ ] Criar proposta digitando comando livre → aparece na lista correta.
  - [ ] Criar proposta com cliente inexistente → modal abre → CNPJ auto-preenche → cliente criado → proposta criada com `clienteId` correto.
  - [ ] Form clássico (expandido) ainda cria proposta normalmente.
  - [ ] Página `/clientes/novo` standalone ainda funciona.
  - [ ] Shift+Enter cria proposta e muda status para `enviada`.
  - [ ] PDF gerado tem todos os campos corretos.
  - [ ] Campo `canalAutorizacao = 'telefone'` no banco quando criado via command-bar.
- [ ] PR criada com link para spec, screenshots da command-bar, e checklist preenchido.

---

## Riscos durante execução

| Risco | Plano B |
|-------|---------|
| `cmdk` conflita com primitives `ui/phb` | Implementar command-bar manual (input + listbox) — fallback simples |
| Parser é menos preciso do que esperado em PT-BR | Mostrar preview SEMPRE — operador valida; reduzir confiança pra mostrar warnings amarelos |
| Modal de cliente trava o flow | Adicionar fast-path: "Pular CNPJ" pra criar com só nome+telefone |
| Lista de 500 clientes pesa | Lazy-load via search endpoint `/api/clientes?search=...` em vez de pre-load |

---

## Próximos milestones (não desta PR)

- **M2 — Voz Web Speech API** — depende de M1.
- **M3 — Quick-finalize WhatsApp + link público PDF** — depende de M1, prepara portal do cliente.
- **Épico Portal Cliente** — usa link público de M3 como onboarding.
