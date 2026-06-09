# SaaS Merco Grain — Especificação e Ordem de Trabalho

> **Para o agente (Claude Code):** este arquivo é uma ordem de trabalho. Não é um documento para apenas ler.
> Para **cada requisito** abaixo você deve seguir o **Protocolo de Execução** logo a seguir.

-----

## 0. Contexto do negócio (leia antes de qualquer coisa)

A **Merco Grain** é uma **corretora / intermediadora (broker) de commodities agrícolas** — trigo, milho e soja. Características que definem TODA a modelagem do sistema:

- **Corretagem pura.** Ela **nunca é dona do grão** e **não toma posição de preço**. A receita dela é **comissão / corretagem** por negócio fechado.
- **Volume equilibrado** entre **mercado interno** e **exportação**.
- Ela conecta **vendedores** (produtor, cooperativa) a **compradores** (indústria, esmagadora, exportador, trader), e oferece **apoio fiscal, logístico e financeiro** — mas **acompanha**, não **executa** a operação física.

### Consequência direta para o escopo — NÃO implementar:

- ❌ Gestão de estoque / armazém
- ❌ Posição própria de grãos
- ❌ Hedge da carteira / gestão de risco de preço próprio
- ❌ Apuração fiscal completa (ela não é a parte fiscal da operação)

Os módulos de fiscal, logística e câmbio devem ser de **acompanhamento e alerta** (checklist, status, rastreio), **não** de execução/gestão pesada.

-----

## 1. Protocolo de Execução (aplicar a cada requisito)

Para cada item das seções 3 a 6:

1. **AUDITAR** — procure no codebase atual se a funcionalidade já existe (busque por rotas, modelos, telas, services, migrations relacionados). Não confie em nomes parecidos: valide se os **critérios de aceite** do item são realmente atendidos.
1. **CLASSIFICAR** o status como:
- ✅ `EXISTE_COMPLETO` — atende todos os critérios de aceite.
- 🟡 `EXISTE_PARCIAL` — existe algo, mas não cobre todos os critérios. Liste o que falta.
- ❌ `NAO_EXISTE` — não há nada.
1. **REPORTAR** — registre o status em `RELATORIO_AUDITORIA.md` (criar na raiz), no formato:
   
   ```
   ## [ID] Nome do requisito
   - Status: EXISTE_COMPLETO | EXISTE_PARCIAL | NAO_EXISTE
   - Evidência: arquivos/rotas/tabelas encontradas
   - Lacunas: o que falta (se parcial)
   - Ação tomada: implementado / pendente / N/A
   ```
1. **IMPLEMENTAR** — se for `NAO_EXISTE` ou `EXISTE_PARCIAL`, implemente respeitando o padrão de arquitetura, stack e convenções já presentes no projeto. **Não introduza framework/lib nova sem necessidade.**
1. **TESTAR** — adicione/rode testes cobrindo os critérios de aceite antes de marcar como concluído.

### Regras gerais

- Respeite a stack e os padrões existentes (linguagem, ORM, estilo de código, estrutura de pastas).
- Implemente na **ordem das fases** (Fase 1 → 4). Não pule fase sem concluir a anterior, salvo dependência inversa explícita.
- Toda entidade financeira deve ter trilha de auditoria (quem criou/alterou, quando).
- Multi-moeda (BRL e USD) é requisito transversal por causa da exportação.
- Datas, fuso e locale em pt-BR.

-----

## 2. Glossário rápido (para evitar erro de modelagem)

- **Oferta**: intenção de **venda** registrada por um vendedor (produtor/cooperativa).
- **Demanda**: intenção de **compra** registrada por um comprador (indústria/exportador).
- **Match**: cruzamento de uma oferta com uma demanda compatível.
- **Negócio / Deal**: match que evoluiu para negociação/fechamento.
- **Base de preço**: FOB, CIF, posto, etc. — define quem paga frete e onde.
- **Corretagem**: comissão da Merco Grain sobre o negócio (% ou R$/tonelada).
- **Contraparte**: qualquer vendedor ou comprador cadastrado.

-----

## 3. FASE 1 — Núcleo (MVP, prioridade máxima)

> Sem isto não há produto. É o que o corretor sente na pele todo dia.

### [F1-01] Cadastro de contrapartes com compliance

- Vendedores e compradores com: CNPJ/CPF, Inscrição Estadual, endereço, dados bancários, contatos.
- Status de regularidade fiscal e validade de documentos/certificações com **alerta de vencimento**.
- Para contraparte de exportação: verificação contra listas restritivas/embargos.
- **Aceite:** é possível cadastrar, editar e listar contrapartes; o sistema alerta documento vencendo; há flag de tipo (vendedor/comprador/ambos).

### [F1-02] Pipeline de ofertas e demandas

- Registro separado de **ofertas (venda)** e **demandas (compra)**.
- Campos: produto (trigo/milho/soja), volume, qualidade/especificação (PH, umidade, avariados, proteína p/ trigo), preço, moeda, base de preço, origem, destino, janela de embarque/entrega, validade da oferta.
- **Aceite:** CRUD completo de ofertas e demandas com todos os campos; filtros por produto, região, validade.

### [F1-03] Motor de match

- Cruza ofertas × demandas por produto, volume, qualidade, base e janela.
- Sugere matches compatíveis e permite criar um **Negócio** a partir de um match.
- **Aceite:** dado um conjunto de ofertas/demandas, o sistema lista matches plausíveis ordenados por compatibilidade; usuário converte match em negócio.

### [F1-04] Gestão de negócios (deal flow)

- Pipeline por estágios: `oferta captada → match → negociação → fechado → embarque/entrega → liquidação → comissão recebida`.
- Cada negócio referencia a oferta, a demanda, as duas contrapartes e os termos finais.
- **Aceite:** é possível mover um negócio entre estágios, ver o funil, e cada estágio guarda data/responsável.

### [F1-05] Motor de comissão (item mais crítico do produto)

- Cálculo de corretagem por negócio: **% sobre valor** OU **R$/tonelada**.
- Definir **quem paga** (comprador, vendedor ou ambos) e o rateio.
- Controle de status: **prevista → faturada → recebida**, com **aging** e **alertas de comissão a receber**.
- Suporte a rateio entre corretores quando houver mais de um.
- **Aceite:** cada negócio gera comissão calculada automaticamente; relatório de comissão prevista x faturada x recebida; alerta de comissão vencida/atrasada.

### [F1-06] Nota / contrato de corretagem

- Geração do documento de confirmação do negócio a partir de **templates customizáveis**.
- Versionamento e **assinatura eletrônica** das duas partes.
- Cláusulas de qualidade, arbitragem de classificação, multas por inadimplência de entrega, condições de pagamento.
- **Aceite:** gerar PDF do contrato a partir de template; registrar assinaturas; manter histórico de versões.

### [F1-07] Dossiê digital do negócio

- Repositório único por negócio com: contrato, NF, romaneio, laudo de classificação, comprovantes, nota de corretagem.
- **Aceite:** anexar e recuperar todos os documentos de um negócio em um clique; busca por negócio/contraparte.

-----

## 4. FASE 2 — Diferenciais que criam dependência

> O que faz o corretor **não trocar** o sistema depois.

### [F2-01] Captura de ofertas por WhatsApp (alto impacto)

- Integração que recebe mensagens (ex.: “tenho 500t de soja em Cruz Alta a R$X”) e usa IA para **estruturar** em oferta/demanda no pipeline, preenchendo campos automaticamente para revisão.
- **Aceite:** mensagem recebida vira rascunho de oferta com campos preenchidos; corretor confirma/edita; nada se perde no scroll.

### [F2-02] Memória de negociação por contraparte

- Histórico por contraparte: preços praticados, produtos, comportamento (“segura 2 semanas”), últimos negócios.
- **Aceite:** ao abrir uma contraparte, ver histórico consolidado de negócios e preços; o conhecimento fica no sistema, não no corretor.

### [F2-03] Régua de follow-up automática

- Lembretes por estágio do pipeline e por **inatividade** de cliente/negócio.
- **Aceite:** negócio parado X dias gera tarefa/alerta ao responsável; régua configurável.

### [F2-04] Calculadoras embutidas

- Paridade de exportação; conversão saca/tonelada/bushel; frete estimado por rota; **líquido ao produtor** após descontos de qualidade (umidade, avariados).
- **Aceite:** cada calculadora acessível dentro do contexto do negócio/oferta; resultados reutilizáveis no negócio.

-----

## 5. FASE 3 — Inteligência de mercado e acompanhamento

### [F3-01] Painel de cotações e câmbio

- CBOT (soja/milho), Cepea/Esalq, paridade de exportação, basis por região, e câmbio USD/BRL (diário ou tempo real).
- **Aceite:** painel atualizado; cotações utilizáveis para precificar ofertas/negócios.

### [F3-02] Alertas de mercado segmentados

- Quando CBOT/câmbio cruza um limite, avisar **quais clientes** têm interesse aberto naquilo e sugerir contato.
- **Aceite:** regra de alerta por limite; notificação lista as contrapartes com posição/interesse relacionado.

### [F3-03] Acompanhamento logístico (rastreio, não execução)

- Status de embarque/entrega, romaneio, frete (quem paga conforme base). Exportação: vínculo com porto/booking/navio.
- **Aceite:** ver status logístico por negócio; registrar frete e responsável; campos de exportação quando aplicável.

### [F3-04] Acompanhamento fiscal (checklist/alerta)

- Acompanhar NF da operação, ICMS/diferimento, Funrural (interno) e regimes de exportação.
- **Aceite:** checklist fiscal por negócio com status e alertas; **sem** apuração própria.

### [F3-05] Câmbio da operação

- Registro do dólar na data e do contrato de câmbio para negócios de exportação.
- **Aceite:** registrar cotação e contrato de câmbio vinculado ao negócio; refletir no valor da comissão em BRL.

### [F3-06] Dashboards

- Volume por produto/período; comissão gerada x recebida; ranking de compradores/vendedores; conversão do pipeline; negócios em aberto x liquidados; margem por negócio.
- **Aceite:** dashboard com esses indicadores filtráveis por período, produto e corretor.

-----

## 6. FASE 4 — Escala, equipe e IA (upsell)

### [F4-01] Portal / área do cliente

- Produtor e comprador postam ofertas/demandas e acompanham seus negócios.
- **Aceite:** login externo; contraparte vê apenas seus próprios dados e negócios.

### [F4-02] App mobile funcional

- Uso real em estrada/fazenda/porto, não só web de escritório.
- **Aceite:** fluxos principais (ver pipeline, registrar oferta, acompanhar negócio, receber alertas) usáveis no celular.

### [F4-03] Gestão de equipe e comissionamento interno

- Vários corretores: rateio de comissão, metas, ranking (visão do dono/CEO).
- **Aceite:** atribuir negócios a corretores; calcular comissão interna; ranking e metas.

### [F4-04] Conciliação bancária (OFX/integração)

- Casar comissão recebida com o negócio correspondente automaticamente.
- **Aceite:** importar extrato; sugerir conciliação; baixar a comissão “recebida”.

### [F4-05] Checklist documental de exportação

- Acompanhar DUE, certificado fitossanitário, BL, booking.
- **Aceite:** checklist por negócio de exportação com status e validade.

### [F4-06] Camada de IA (transversal)

- Resumir negociação longa; redigir proposta ao cliente; classificar mensagens; sugerir matches.
- **Aceite:** cada função acessível no contexto do negócio; saída editável antes de usar.

-----

## 7. Ordem de prioridade recomendada (se houver corte de tempo)

Para a **primeira entrega vendável**, garantir nesta ordem:

1. [F1-05] Motor de comissão
1. [F2-01] Captura por WhatsApp
1. [F1-07] Dossiê do negócio
1. Restante da Fase 1
1. Fases 2 → 4

> Justificativa: comissão é o P&L inteiro do corretor; WhatsApp é onde o trabalho realmente acontece; dossiê protege contra disputa. São as três dores que nenhum ERP genérico resolve bem.

-----

## 8. Entregáveis esperados do agente ao final

- [ ] `RELATORIO_AUDITORIA.md` preenchido com status de todos os requisitos.
- [ ] Código implementado para tudo que estava `NAO_EXISTE` / `EXISTE_PARCIAL`, respeitando a ordem de fases.
- [ ] Testes cobrindo os critérios de aceite.
- [ ] Lista de pendências/decisões que precisam de validação humana (ex.: fonte de dados de cotação CBOT, provedor de assinatura eletrônica, provedor da API de WhatsApp).