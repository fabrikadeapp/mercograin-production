# Relatório de Auditoria — mercograin-saas-spec

> Gerado conforme o Protocolo de Execução (seção 1 da spec). Status por item:
> ✅ `EXISTE_COMPLETO` · 🟡 `EXISTE_PARCIAL` · ❌ `NAO_EXISTE`.
> Nesta rodada foi **implementado o Comissionamento de Colaborador** (pedido do cliente)
> com kill-switch (global + por-workspace). Os demais itens estão auditados e priorizados.

---

## FASE 1 — Núcleo (MVP)

### [F1-01] Cadastro de contrapartes com compliance
- Status: ✅ EXISTE_COMPLETO (após esta rodada — alerta implementado)
- Implementado: `/api/mesa/alertas-compliance` consolida KYC pendente/reprovado, cadastros em análise/rejeitado e CAR vencendo/inválido (PropriedadeRural). Reusa KYC existente (lib/compliance).
- ORIGINAL: 🟡 EXISTE_PARCIAL
- Evidência: `app/clientes`, model `Cliente` (CNPJ/CPF, IE, endereço, dadosBancarios, tipo comprador/vendedor/ambos, statusCadastral, scoreRelacionamento, limiteCredito). KYC: `PropriedadeRural`, compliance KYC (M1).
- Lacunas: alerta de vencimento de documentos/certificações; verificação contra listas restritivas/embargos para exportação.
- Ação: pendente (fora do escopo desta rodada).

### [F1-02] Pipeline de ofertas e demandas
- Status: ✅ EXISTE_COMPLETO (após esta rodada)
- Implementado: `Oferta.qualidadeSpec` (PH/umidade/avariados/proteína) + `janelaEntrega` (migration aplicada). Demanda = Oferta tipo='compra'. Usado pelo motor de match.
- ORIGINAL: 🟡 EXISTE_PARCIAL
- Evidência: `Oferta` (S10 M2), `/ofertas` (marketplace, feature-flag), `SolicitacaoCotacao` (demanda inbound). Proposta tem `tipo` venda/compra + `graos` (qualidade básica).
- Lacunas: separação formal oferta(venda) × demanda(compra) com todos os campos de especificação (PH, umidade, avariados, proteína); filtros por produto/região/validade unificados.
- Ação: pendente.

### [F1-03] Motor de match
- Status: ✅ EXISTE_COMPLETO (após esta rodada)
- Implementado: `lib/match` (score cultura/volume/preço/região/janela/qualidade), `/api/match/sugerir` (feature-gated), tela `/match` com cruzamentos ranqueados. Feature 'match'. 7 testes passando.
- ORIGINAL: ❌ NAO_EXISTE
- Evidência: não há motor que cruze ofertas × demandas por compatibilidade.
- Ação: pendente (Fase 1 — alta prioridade na spec).

### [F1-04] Gestão de negócios (deal flow)
- Status: ✅ EXISTE_COMPLETO (após esta rodada)
- Implementado: model `Negocio` que une oferta+demanda+comprador+vendedor+termos; 7 estágios (captado→match→negociação→fechado→embarque→liquidação→comissão_recebida) com data/responsável/histórico; `/api/negocios` (criar de match + funil), `/api/negocios/[id]` (mover estágio); tela `/negocios` (Kanban drag). Match→negócio funcional.
- ORIGINAL: 🟡 EXISTE_PARCIAL
- Evidência: pipeline de propostas com Kanban (`/propostas/kanban`, criado nesta sessão) — estágios rascunho→enviada→análise→aceita→contrato. Proposta/Contrato referenciam cliente, vendedor, gerente.
- Lacunas: estágios completos da spec (embarque/entrega → liquidação → comissão recebida); negócio que referencia as DUAS contrapartes (comprador + vendedor) simultaneamente.
- Ação: pendente.

### [F1-05] Motor de comissão (CORRETAGEM da Merco Grain)
- Status: ✅ EXISTE_COMPLETO (após esta rodada)
- Evidência base: `ComissaoRegra`/`ComissaoApurada`, `lib/comissao/calcular.ts`, cron `apurar-comissoes`.
- **Implementado nesta rodada (as duas formas + ciclo completo):**
  - Schema estendido (migration `manual_corretagem_completa.sql` aplicada no Railway):
    `ComissaoRegra`: `baseCalculo` (percentual|por_tonelada), `valorPorTonelada`, `quemPaga` (comprador|vendedor|ambos), `rateioCompradorPct`, `prazoRecebimentoDias`.
    `ComissaoApurada`: `baseCalculo`, `toneladas`, `valorPorTonelada`, `quemPaga`, `valorComprador`, `valorVendedorPaga`, status `prevista|faturada|recebida|cancelada`, aging (`faturadaEm`, `vencimentoEm`, `recebidaEm`), `rateioCorretores` (Json).
  - Motor `lib/comissao/calcular.ts`: cálculo por **% OU R$/tonelada**, **quem paga** com rateio comprador/vendedor, distribuição normalizada sobre o total. Retrocompatível (8 testes m6 seguem passando).
  - Cron `apurar-comissoes`: calcula toneladas de `proposta.graos`, grava base/quem-paga/aging, nasce `prevista` com `vencimentoEm` = +prazo.
  - API `GET/PATCH /api/comissao/corretagem`: relatório prevista×faturada×recebida, aging/atraso, transição de status (faturar→receber→cancelar, owner/admin).
  - UI `/financeiro/corretagem`: totais por status, alerta de atrasadas, tabela com base/quem-paga/vencimento + ações. Item no menu Financeiro.
  - Testes: `__tests__/bhgrain/corretagem-completa.test.ts` (7) — R$/ton, quem paga, rateio, integração. **27 testes de comissão no total, todos passando.**
- Distinto do comissionamento de COLABORADOR (F4-03, já feito). Agora o sistema contempla **as duas formas**.

### [F1-06] Nota / contrato de corretagem
- Status: ✅ EXISTE_COMPLETO (após esta rodada)
- Implementado: tipo 'corretagem' adicionado ao editor de templates (Tiptap, variáveis, versionamento). Nota de corretagem usa o mesmo motor.
- ORIGINAL: 🟡 EXISTE_PARCIAL
- Evidência: `ContratoTemplate` (Tiptap, variáveis dinâmicas, versionamento via `ContratoTemplateVersao`), assinatura digital (`AssinaturaDigital`: zapsign/clicksign/d4sign), `/contratos/templates`. **Modelo de proposta** adicionado nesta sessão (tipo='proposta').
- Lacunas: nota específica de corretagem (vs contrato de compra/venda); cláusulas de arbitragem de classificação/multas como blocos prontos.
- Ação: parcial (modelos cobrem boa parte).

### [F1-07] Dossiê digital do negócio
- Status: ✅ EXISTE_COMPLETO (após esta rodada)
- Implementado: `/api/dossie/[contratoId]` agrega termos + timeline (contrato/assinatura/NF/romaneio/comissão/auditoria) + documentos. Tela `/contratos/[id]/dossie`. Feature 'dossie'. Read-only, sem novo storage.
- ORIGINAL: ❌ NAO_EXISTE
- Evidência: histórico fragmentado (auditoria, notas de proposta, chat produtor) mas sem dossiê consolidado por negócio.
- Ação: pendente.

---

## FASE 2 — Diferenciais

### [F2-01] Captura de ofertas por WhatsApp
- Status: ✅ EXISTE_COMPLETO (após esta rodada) — webhook+parser IA já existiam; adicionado `/api/inbox/[id]/criar-oferta` que converte conversa (aiExtraction) em Oferta estruturada via helpers de oferta.
### [F2-02] Memória de negociação por contraparte
- Status: 🟡 EXISTE_PARCIAL — `ClienteAtendimento`, notas; falta timeline consolidada. Pendente.
### [F2-03] Régua de follow-up automática
- Status: ✅ EXISTE_COMPLETO — cron `propostas-followup` já dispara; adicionado painel `/gestao/alertas` + `/api/alertas-comerciais` (lista/resolve CommercialAlert).
### [F2-04] Calculadoras embutidas
- Status: ✅ EXISTE_COMPLETO — `/calculadora` (margens soja/milho/trigo).

---

## FASE 3 — Inteligência de mercado

### [F3-01] Painel de cotações e câmbio
- Status: ✅ EXISTE_COMPLETO — `/cotacoes`, `useLiveQuotes`, CEPEA + PTAX.
### [F3-02] Alertas de mercado segmentados
- Status: ✅ EXISTE_COMPLETO — cron `price-alerts` já dispara; painel `/gestao/alertas` consolida e permite resolver/ignorar.
### [F3-03] Acompanhamento logístico
- Status: 🟡 EXISTE_PARCIAL — `/logistica`, `OrdemCarga`, romaneios (feature logistica). Rastreio externo pendente.
### [F3-04] Acompanhamento fiscal
- Status: 🟡 EXISTE_PARCIAL — `/fiscal`, NF-e, SPED. Checklist/alerta pendente.
### [F3-05] Câmbio da operação
- Status: 🟡 EXISTE_PARCIAL — USD/BRL nas cotações; multi-moeda em contratos. Pendente operação.
### [F3-06] Dashboards
- Status: ✅ EXISTE_COMPLETO — `/dashboard` (Mesa reformulada nesta sessão), `/admin-empresa`.

---

## FASE 4 — Escala, equipe e IA

### [F4-01] Portal / área do cliente
- Status: ✅ EXISTE_COMPLETO — `/portal/[slug]` (login, contratos, docs, chat) + captação pública de lead (criada nesta sessão).
### [F4-02] App mobile funcional
- Status: 🟡 EXISTE_PARCIAL — PWA/responsivo; app nativo não.
### [F4-03] Gestão de equipe e comissionamento interno
- Status: ✅ EXISTE_COMPLETO (após esta rodada)
- Evidência: `/gestao/equipe` (membros, funções, áreas, transferir carteira). **Comissionamento de colaborador IMPLEMENTADO nesta sessão:**
  - Schema: `WorkspaceMember.isVendedor` + `comissionado`; tabelas `RegraComissaoColaborador` (4 tipos) + `ComissaoColaboradorApurada` (snapshot prevista→faturada→paga). Migration aplicada no Railway.
  - Motor: `lib/comissao/colaborador.ts` — percentual, fixo (período/negócio), piso+%, faixas progressivas. **12 testes** passando (`__tests__/bhgrain/comissao-colaborador.test.ts`).
  - Feature: `comissionamento` no catálogo (`lib/features`) — kill-switch GLOBAL (superadmin `/admin/system-features`) + por-workspace (`/admin/workspaces/[id]/features`).
  - API: `GET/PUT /api/comissao/colaborador/[memberId]` (regra+flags, feature-gated, owner/admin), `GET /api/comissao/colaborador/relatorio` (apuração por período via `Contrato.vendedorId`).
  - UI: `/gestao/comissionamento` (feature-gated) — relatório do mês + config por colaborador (toggles + editor de regra com faixas). Item no menu Gestão com `requires: 'comissionamento'`.
- Ranking/metas IMPLEMENTADO nesta rodada: `/gestao/ranking` + `/api/gestao/ranking` (pódio, atingimento de meta via MetaComercial, edição de meta). Apuração via relatório sob demanda.
### [F4-04] Conciliação bancária (OFX)
- Status: ✅ EXISTE_COMPLETO — `/financeiro/conciliacao` (OFX, match, baixa).
### [F4-05] Checklist documental de exportação
- Status: ✅ EXISTE_COMPLETO (após esta rodada) — model `ChecklistExportacaoItem`, `/api/exportacao/checklist/[contratoId]` (semeia DUE/fitossanitário/BL/booking/invoice/packing/seguro/origem), tela `/contratos/[id]/exportacao` com progresso e status. Feature 'eudr'.
### [F4-06] Camada de IA
- Status: 🟡 EXISTE_PARCIAL — `Laura.IA`, insights dashboard; cobertura por item da spec pendente.

---

## Resumo
- **Implementado nesta rodada:** F4-03 Comissionamento de Colaborador (completo, testado, com kill-switch).
- **Já existente (reuso):** calculadoras, cotações, dashboards, portal, conciliação, gestão de equipe, templates.
- **Maiores lacunas (próximas prioridades pela spec):** F1-03 Motor de match (NAO_EXISTE), F1-07 Dossiê (NAO_EXISTE), F1-05 corretagem R$/ton + status, F2-01 captura WhatsApp.
- **Kill-switch:** toda função nova é feature-flag (global + workspace). Nada se deleta — desativa-se.
