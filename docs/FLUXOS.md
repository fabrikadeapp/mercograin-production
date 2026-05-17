# Fluxos principais do BH Grain

## 1. Onboarding novo cliente da plataforma

1. `/auth/signup` → cria User + envia verify-email
2. `/auth/verify-email/[token]` → ativa email
3. `/auth/login` → login bem-sucedido
4. `/onboarding` → coleta dados workspace, plano, dados empresa
5. POST `/api/onboarding/complete` → marca onboardingCompletedAt
6. Redireciona pra `/dashboard`

## 2. Convite de colaborador

1. CEO em `/gestao/equipe` clica "Adicionar colaborador"
2. Preenche email, cargo, funções (multi-select), áreas (Mesa/Financeiro/Fiscal/Gestão)
3. POST `/api/workspace/members` cria WorkspaceMember(status='invited') + envia email via Resend
4. Colaborador recebe email com link `/auth/aceitar-convite/[token]`
5. Se não tem conta: form de criar User (nome + senha)
6. Se tem conta: precisa logar e voltar com mesmo email
7. POST `/api/workspace/members/accept` vincula User ao membership, seta status='active'

## 3. Atribuição cliente → corretor

1. CEO cadastra cliente em `/clientes/novo` (escolhe responsável = WorkspaceMember.id)
2. POST `/api/clientes` valida que responsavelId pertence ao workspace ativo
3. Cria Cliente + ClienteAtendimento(motivo='inicial')
4. Cliente passa a aparecer na visão "Minha carteira" do corretor

## 4. Transferência de carteira

1. CEO em `/gestao/equipe` clica botão "Transferir carteira" no corretor antigo
2. Modal lista clientes do origem, escolhe destinatário e motivo
3. POST `/api/equipe/[memberId]/transferir-carteira` em transação:
   - Fecha ClienteAtendimento ativos do origem (fimEm=now)
   - Cria novos ClienteAtendimento pro destinatário
   - Atualiza Cliente.responsavelId
4. NÃO mexe em vendedorId histórico de propostas/contratos (crédito preservado)

## 5. Criação de proposta (canal web)

1. Trader em `/propostas/nova` seleciona cliente, tipo, validade, grãos
2. POST `/api/propostas` sem informar número (servidor gera)
3. nextNumber() gera `MCG2026051701P` (3 letras do workspace + AAAAMMDD + seq + P)
4. Auto-preenche vendedorId = membership do criador, gerenteContaId = responsavelId do cliente, canalAutorizacao='web'
5. Status inicial = 'rascunho'

## 6. Criação de proposta via Laura.IA (canal externo)

1. WhatsApp/Telefone/Bot → backend chama POST `/api/laura/propostas`
2. nextNumber() gera mesmo formato, mas com canalAutorizacao='whatsapp'|'telefone'|'ia_autonomo'
3. Status inicial = 'aguardando_autorizacao' (não envia automaticamente)
4. Aparece em `/aprovacoes/propostas` para humano aprovar
5. Quem aprovar fica como vendedorId, autorizadoEm/Por preenchidos

## 7. Aprovação de proposta pendente (Laura.IA)

1. Usuário (gerente conta ou owner/admin) em `/aprovacoes/propostas`
2. Card mostra canal (WhatsApp/Telefone/IA), cliente, grãos, valor, idade
3. Clica "Aprovar e enviar" → POST `/api/propostas/[id]/autorizar` {acao:'aprovar'}
4. Status muda 'aguardando_autorizacao' → 'enviada'
5. autorizadoPorId e vendedorId preenchidos com membership atual
6. Aparece na lista normal de propostas enviadas

## 8. Fluxo Proposta → Contrato

1. Cliente aceita proposta → trader em `/propostas/[id]` marca como "aceita"
2. PATCH `/api/propostas/[id]` { status: 'aceita' }
3. Botão "Criar contrato" leva a `/contratos/novo?proposIdFk={id}`
4. Formulário pré-preenche, define dataInicio/dataFim
5. POST `/api/contratos` sem informar número (servidor gera `MCG2026051701C`)
6. Cria Contrato + dispara workflow de aprovação se houver

## 9. Assinatura digital do contrato

1. Contrato criado com statusAssinatura='pendente'
2. CEO/owner usa provedor de assinatura (D4Sign/Clicksign/DocuSign — config Admin)
3. Webhook `/api/webhooks/signature/[provider]` recebe evento de assinatura
4. Atualiza Contrato.statusAssinatura='assinado' + assinadoEm
5. Upload do PDF assinado vai pro Railway Volume `/data/uploads/contratos-assinados/`
6. URL pública via `/api/files/<bucket>/<path>`

## 10. Apuração de comissão (automática)

1. Cron `apurar-comissoes` roda diariamente
2. Para cada Contrato novo sem ComissaoApurada:
   - Busca regra ativa por workspace+escopo (cultura/mesa/corretor)
   - Calcula valorTotalComissao = valorContrato × pctTotal
   - Distribui entre corretor/originador/mesa/house conforme pctX
   - Cria ComissaoApurada(status='apurada')
3. Aparece em `/financeiro/comissoes`

## 11. Cobrança de comissão (corretora cobra parceiro)

1. CEO em `/financeiro/comissoes` clica "Cobrar" numa comissão
2. POST `/api/comissao/apuradas/[id]/cobrar` { destinatarioTipo, vencimento }
3. Gera Boleto vinculado ao contratoId com valor=valorCorretor (ou outro)
4. Boleto aparece em `/boletos`, integra com Braspag para emissão real
5. Pagamento via webhook Braspag → marca boleto pago

## 12. Pausar / despausar integrações

1. Topbar tem Health bar com toggles de cada integração (WhatsApp, Email, etc)
2. Click pausa: POST `/api/bhgrain/health/toggle` { paused: true, pausedUntil, pausedReason }
3. Cron skips essa integração até pausedUntil
4. Mensagens recebidas durante pausa ficam silenciadas (não descartadas)
5. Ao reativar: modal "X mensagens silenciadas durante a pausa, o que fazer?"
   - Processar tudo (IA classifica)
   - Marcar todas como lidas
   - Descartar tudo (irrecuperável)

## 13. Performance individual

1. CEO em `/gestao/equipe/[id]` vê 6 KPIs do colaborador:
   - Clientes ativos (sob responsabilidade)
   - Propostas criadas no período
   - Contratos fechados
   - GMV
   - Taxa de conversão
   - Ticket médio
2. Filtros: 30/90/365 dias
3. API `/api/equipe/[memberId]/performance?periodo=mes|trim|ano`

## 14. Bloqueio de área

1. Colaborador com areasPermitidas=['mesa'] tenta acessar `/financeiro`
2. Middleware: routeToArea('/financeiro') = 'financeiro'
3. canAccessArea(user, 'financeiro') = false
4. Redirect pra getDefaultRouteFor(user) = `/bhgrain` (Mesa)
5. owner/admin/admin global passam sempre

## 15. Logout / suspensão de usuário

1. CEO suspende colaborador (status=suspended em WorkspaceMember)
2. JWT do user ainda válido por até 4h (session.maxAge)
3. Próxima validação JWT: workspaceMemberships{where:status='active'} retorna vazio
4. Token marca workspaceRole=null, areasPermitidas=[]
5. Middleware redireciona pra `/sem-acesso`
