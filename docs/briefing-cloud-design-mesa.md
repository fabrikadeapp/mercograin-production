# Briefing — Remodelagem do Dashboard da Mesa de Operações (BH Grain)

> Cole este texto na ferramenta de design (Cloud Design) para gerar opções de
> layout. Ele descreve o produto **real**, as funções já implementadas e o que
> queremos da remodelagem. Não é um wishlist — tudo abaixo já existe no sistema.

---

## 1. O que é o produto

**BH Grain** é um SaaS multi-tenant (cada corretora = um workspace) para **mesa
de operações de trading de grãos** — soja, milho, trigo e sorgo. Quem usa é o
**corretor / operador de mesa**: a pessoa que recebe pedidos de produtores e
compradores, monta propostas, fecha contratos e acompanha o pipeline o dia
inteiro. O dashboard da Mesa é a tela onde ela vive.

**Princípios visuais que já valem:**
- Tela **full-width, sem barra lateral fixa** — maximizar área útil, o operador
  não deve rolar muito para ver o essencial.
- Visual **premium, denso e profissional** (estilo terminal de trading), nunca
  "cara de template de IA".
- Tema escuro como padrão + **10 design systems** selecionáveis por corretora.
- Tom: dados em tempo real, hierarquia clara, ação rápida.

---

## 2. O que o dashboard mostra HOJE (de cima para baixo)

1. **Cabeçalho** — saudação dinâmica ("Bom dia, Fulano · Corretora X"), título
   "Mesa de Operações", subtítulo com contadores da fila ("2 travadas · 3
   pedidos · 5 rascunhos aguardando você"). Botões: **Registrar pedido**
   (telefone/presencial), **Kanban**, **+ Nova proposta**.

2. **4 KPIs no topo** (grid de 4 cards):
   - **Propostas** — total ativas + status (aceita / enviada / rascunho…).
   - **Contratos** — total ativos + status (assinado / enviado / pendente…).
   - **Vendido** — valor + toneladas em 4 janelas: **Hoje · Semana · Quinzena ·
     30 dias** (Hoje em destaque).
   - **Cotações ao vivo** — SOJA, MILHO, TRIGO e USD/BRL com preço e variação %
     (▲▼), indicador "ao vivo" pulsante. Fonte: **CEPEA** (grãos) e câmbio.

3. **Inbox unificado** — últimas 5 conversas de **WhatsApp / e-mail / portal**,
   com badge verde "pronta" quando a **IA já preparou uma proposta** e badge de
   não-lidas.

4. **Fila de ação** (coluna esquerda) — itens ordenados por urgência (SLA em
   horas, vermelho ≥24h). Três tipos: **PEDIDO** (produtor quer vender),
   **RASCUNHO** (proposta montada e não enviada, inclui as geradas por IA),
   **TRAVADA**. Cada item tem ação direta ("Aceitar" / "Revisar").

5. **Pipeline de propostas** (coluna direita) — tabela densa: cliente, valor,
   data, status. Link para o **Kanban**.

6. **3 cards inferiores**: **Assinatura pendente** (contratos aguardando
   assinatura digital), **Fixações de preço** (janela de fixação restante),
   **Risco & limites** (exposição vs. teto, com barra — feature de hedge,
   desligável).

7. **Barra de status** (rodapé) — saúde das integrações (WhatsApp, e-mail,
   pagamentos…) com latência e "X/Y ok".

---

## 3. Funções NOVAS que instalamos e que o dashboard ainda NÃO destaca bem

O dashboard atual foi desenhado antes destas funções. Queremos que a remodelagem
dê **lugar de destaque** a elas, porque são o que torna o produto mais completo:

| Função | O que faz | Hoje no dashboard |
|---|---|---|
| **Automação de COMPRA (Demandas)** | Quando um cliente diz que quer **comprar** (WhatsApp, e-mail, Instagram, telefone, manual), a IA estrutura uma **demanda**, varre os **vendedores** e gera **propostas de compra** (preço = CEPEA − margem). Tela própria em `/demandas` com kill-switch. | Não aparece — só na tela `/demandas`. |
| **Automação de VENDA** | Espelho: cliente quer **vender** → IA varre **compradores** → gera **propostas de venda** (CEPEA + margem). | Aparece misturado como rascunho na fila. |
| **Propostas geradas por IA** | Status `rascunho_ia` — montadas automaticamente, aguardando revisão humana. **Nada é enviado sem aprovação.** | Misturadas com rascunhos comuns, sem selo "IA". |
| **Envio documental ao cliente** | Ao mover proposta para "Enviada" (no Kanban), confirma e **envia de verdade**: **e-mail é o canal documental/formal** (prova em disputa) + WhatsApp como aviso. Contrato vai para **assinatura digital**. | Não tem feedback no dashboard. |
| **Match / pareamento** | Algoritmo casa ofertantes ↔ demandantes e pontua os melhores. | Roda em silêncio, sem indicador. |
| **Alertas de preço** | Monitora faixas de preço e dispara avisos. | Tela `/alertas`, fora do dashboard. |
| **Comissionamento & corretagem** | Motor de comissão de colaborador (percentual, fixo, piso+%, faixas) + corretagem (quem paga, rateio) + **ranking**. | Só em `/gestao`. |
| **Contratos (pipeline + assinatura)** | Pipeline completo + assinatura digital (Zapsign/Clicksign/nativo). | Dashboard só mostra "assinatura pendente". |
| **Logística / cargas** | Em trânsito, agendadas, entregues. | Não aparece na Mesa. |
| **Feature flags / kill switch** | Toda função nova pode ser ligada/desligada por workspace e no superadmin. **Nada se deleta — no máximo se desativa.** | Configurado em `/configuracoes`. |

---

## 4. O que queremos da remodelagem

Gerar **3 a 5 opções de layout** para o dashboard da Mesa que:

1. **Dêem protagonismo à automação por IA** — um lugar claro para "propostas
   montadas pela IA aguardando você revisar e enviar", com selo visual de IA e
   ação de 1 clique ("Revisar & enviar"). Separar compra de venda com rótulo.

2. **Unifiquem compra e venda** num fluxo coerente — hoje "vender" está na fila e
   "comprar" está escondido em `/demandas`. Idealmente um só painel de **fluxo de
   negócios** (entrada → proposta → contrato → assinatura) onde dá para ver o tipo
   (compra/venda) e o estágio.

3. **Mostrem o ciclo de vida de um negócio** (timeline/funil): pedido recebido →
   proposta gerada → enviada (e-mail documental) → em negociação → aceita →
   contrato → assinatura → fixação → logística. Hoje isso está espalhado em vários
   cards isolados.

4. **Tragam métricas novas para a primeira dobra**: matches gerados no dia, taxa
   de conversão, comissão do mês / top colaboradores, alertas de preço disparados.

5. **Preservem o que já funciona bem**: cotações ao vivo, "Vendido" em 4 janelas,
   inbox unificado, saúde das integrações.

6. **Mantenham os princípios visuais**: full-width sem sidebar fixa, denso e
   premium, tema escuro + 10 temas, hierarquia para decisão rápida.

**Restrições reais (não ignore):**
- Cotações vêm de fonte externa (CEPEA + câmbio), com pequeno atraso de cache.
- Propostas de IA são sempre **rascunho** — exigem revisão humana antes de enviar.
- E-mail é o canal **formal/documental**; WhatsApp é complementar.
- Cada função é **desligável** (kill switch) — o layout deve degradar bem quando
  um módulo está off (ex: hedge/risco desativado → o card some, não quebra).

---

## 5. Persona e contexto de uso

- **Usuário:** corretor/operador de mesa de grãos, olhando a tela o dia todo,
  decidindo rápido entre dezenas de pedidos.
- **Ambiente:** desktop amplo (terminal de trading), eventualmente uma TV/painel.
- **Objetivo dele:** não perder pedido, responder rápido, fechar mais negócios,
  ter o registro formal de tudo.

---

## 6. Inspiração de tom

Terminais de trading profissionais (Bloomberg-like), porém limpos e modernos:
densidade de informação com respiro, números com hierarquia tipográfica forte,
cor usada com parcimônia para sinalizar estado (verde/vermelho/âmbar), nunca
decorativa. Premium, sóbrio, confiável.
