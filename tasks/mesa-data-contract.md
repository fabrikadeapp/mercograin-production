# Contrato de Dados — Mesa de Operações (EPIC B)

Cada bloco da nova Mesa → fonte real. Padrão de todos os endpoints novos:
`getScope()` → `scope.whereOwn()` → `db.X.findMany`. `runtime nodejs`, `dynamic force-dynamic`.

## Blocos × fonte

| Bloco | Endpoint | Status | Notas |
|---|---|---|---|
| Fila: pedidos inbound | `/api/solicitacoes?status=pendente` | ✅ existe | `SolicitacaoCotacao` (cliente, grao, quantidade, unidade, precoAlvo, status, createdAt) |
| Fila: rascunhos | `/api/propostas?status=rascunho` | ✅ existe | `Proposta` |
| Fila: travadas | `/api/propostas?status=cancelada` | ⚠️ parcial | sem campo de motivo de erro — usar `cancelada` por ora |
| **Fila unificada (agrega as 3)** | `/api/mesa/fila-acao` | 🔨 CRIAR | normaliza para `{origem, cliente, resumo, sla, href, acao}` ordenado por urgência |
| Pipeline (tabela) | `/api/propostas?status=...&limit&page&search` | ✅ existe | `{ data[], total, page, limit, pages }` |
| KPI Propostas (funil) | `/api/dashboard/stats` → `propostasPorStatus[]` | ✅ existe | `[{status,_count}]` |
| KPI Contratos (funil) | `/api/dashboard/stats` → `contratoPorStatus[]` | ✅ existe | `[{statusAssinatura,_count}]` |
| KPI Vendido (dia/sem/quinz/30d) | `/api/mesa/vendido` | 🔨 CRIAR | soma `Contrato` fechados por janela temporal |
| KPI Cotações | `useLiveQuotes()` → `/api/cotacoes/live` | ✅ existe | `{soja,milho,trigo,usdbrl}` cada `{price,changePct}` |
| Assinatura pendente | `/api/mesa/assinaturas` | 🔨 CRIAR | `Contrato statusAssinatura=pendente` + `AssinaturaDigital` |
| Fixações de preço | `/api/mesa/fixacoes` | 🔨 CRIAR | `ContratoFixacao statusFixacao != totalmente_fixado` + janela `fixacaoFim` |
| Risco & limites | `/api/mesa/risco` | 🔨 CRIAR | `LimiteRisco ativo` + `LimiteBreach` não resolvido |
| Rodapé status | `/api/mesa/integracoes` | 🔨 CRIAR | `IntegrationHealth` + `WhatsAppInstance`/`IntegrationCredential` |

## Campos-chave confirmados (schema real)

- **SolicitacaoCotacao**: clienteId→cliente.nome, tipo(venda|compra), grao, quantidade(Decimal), unidade(t|sc), precoAlvo, status(pendente|em_analise|convertida|recusada|cancelada), createdAt.
- **Proposta**: numero, clienteId→cliente.nome, tipo, graos(Json[{grao,quantidade,preco}]), valorTotal(Decimal), status(rascunho|enviada|aceita|recusada|expirada|cancelada), validadeEm, criadaEm.
- **Contrato**: numero, clienteId, statusAssinatura(pendente|assinado|recusado|expirado|cancelado), modalidade(fixo|a_fixar|misto|barter|triangular), assinadoEm, dataFim, criadoEm.
- **ContratoFixacao**: contratoId, modalidade, qtdTotalSc, qtdFixadaSc, qtdRemanescenteSc, fixacaoInicio, fixacaoFim, gatilhoTipo, gatilhoPrecoSc, gatilhoCultura, statusFixacao.
- **LimiteRisco**: escopo, escopoFiltro(Json), tipo(exposicao_usd|exposicao_brl|qtd_sc|var_usd|pnl_neg_usd), valorMaximo(Decimal), valorAviso, ativo.
- **LimiteBreach**: limiteId, valorAtual, valorMaximo, excedidoEm(%), severidade(aviso|breach|critico), detectadoEm, resolvidoEm.
- **IntegrationHealth**: integration(whatsapp|email|instagram|portal|precos|ia|financeiro), status(online|instavel|atraso|erro|desconectada), responseTimeMs, lastErrorMessage, paused.

## Componentes reutilizáveis (assinaturas)

- `DenseTable<T>`: `{ columns: {key,header,accessor,align?,width?}[], rows, rowKey, onRowClick?, empty?, className? }`
- `KPICard`: `{ eyebrow, value, delta?:{value,trend:'pos'|'neg'|'neutral'}, subtitle?, sparklineData?, sparklineColor? }`
- `Badge`: `{ variant }` mapeia assinado→pos, pendente→warn, rascunho→neutral, cancelado→neg
- `PageHeader`, `AppShell`, `Skeleton`, `EmptyState`, `Card`

## Pendências de schema (documentadas, não bloqueiam)
- Campo de motivo de travamento na Proposta (`lastErrorMsg`) — futuro. Por ora "travada" = status cancelada.
