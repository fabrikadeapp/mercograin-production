# Plano de QA via Browser (Playwright MCP) — executar na PRÓXIMA sessão

> O Playwright MCP foi adicionado a `~/.claude.json` e o Chromium instalado nesta
> sessão, mas as ferramentas `mcp__playwright__*` só carregam ao **reiniciar** o
> Claude Code. Reinicie e diga "executa o qa-browser-plan" para rodar isto.

## Pré-requisitos (já feitos)
- [x] `claude mcp add playwright --scope user -- npx -y @playwright/mcp@latest`
- [x] `npx playwright install chromium` (chromium-1223 instalado)
- [ ] Reiniciar Claude Code para carregar `mcp__playwright__*`

## Credenciais
- URL: https://www.profitsync.ia.br
- Login: `admin@mercograin.com` / `Merco@2026!` (sem 2FA)
- Workspace de teste: "Gustavo (Aero)" (slug `gustavo-aero`, id `cmpc2d0s40028afc7u3i68bay`)

## Convenção de dados de teste
Prefixar TODO registro criado com **`QA-TEST`** no nome/descrição, para
localizar e limpar depois. Ex.: cliente "QA-TEST Cliente Browser".

## Por que browser (e não HTTP)
HTTP puro bate na proteção CSRF do NextAuth v5 (todos os POST → 401). O browser
real, na mesma origem, passa. Já validado: GETs/navegação OK; falta a ESCRITA.

## Roteiro de teste (escrita real — o que faltou)

### 1. Login
1. `browser_navigate` → `/auth/login`
2. Preencher e-mail/senha, submeter, confirmar que chega em `/dashboard`.

### 2. Novo cliente (form que grava)
1. Navegar `/clientes/novo`
2. Preencher: nome "QA-TEST Cliente Browser", tipo=comprador, tipoPessoa=PJ
3. Submeter. Verificar: toast de sucesso, redireciono p/ `/clientes` ou detalhe.
4. Confirmar que aparece na listagem `/clientes` (busca "QA-TEST").

### 3. Nova proposta (cadeia completa)
1. Navegar `/propostas/nova`
2. Selecionar o cliente QA-TEST, tipo=venda, adicionar grão soja 1000sc @ R$50,
   validade +7 dias.
3. Submeter. Verificar sucesso + proposta na listagem `/propostas`.

### 4. Demais forms (smoke de escrita)
- `/leads/novo` → "QA-TEST Lead"
- `/ofertas/nova` → venda soja 500sc
- `/alertas` → criar alerta SOJA > 130
- `/boletos/novo` → boleto p/ o cliente QA-TEST (se aplicável)

### 5. Ações dentro de telas de detalhe
- Abrir a proposta QA-TEST → botão "Editar" salva? "Criar contrato" funciona?
- No Kanban, arrastar a proposta p/ "Enviada" → modal de confirmação de envio
  documental aparece e dispara?

### 6. Para cada form, registrar:
- [ ] Botão submete sem erro de console?
- [ ] Mostra loading + toast de sucesso?
- [ ] Persiste (aparece na listagem / banco)?
- [ ] Trata erro de validação (ex.: submeter vazio mostra mensagem)?

## Limpeza pós-teste
Listar e remover os registros `QA-TEST` (ou marcar inativos — política do projeto:
não deletar, desativar). Comando de verificação no banco:
`prisma` → `cliente.findMany({ where: { nome: { startsWith: 'QA-TEST' } } })`.

---

# RESULTADOS DA EXECUÇÃO — 2026-06-10 (sessão browser/Playwright)

Usuário operacional: `admin@mercograin.com` (owner do workspace "Gustavo (Aero)").

## ✅ O que funcionou (escrita real validada UI → API → banco)
| Fluxo | Resultado | Evidência |
|-------|-----------|-----------|
| Login | OK | chega em `/dashboard` |
| Novo cliente (`/clientes/novo`) | OK | `QA-TEST Cliente Browser` persistido, aparece na listagem |
| Autofill por CNPJ | OK (feature bônus) | preencheu endereço/telefone de empresa real |
| Nova proposta (`/propostas/nova`) | OK | `MER2026061001P` soja R$ 50.000 rascunho, subtotal correto |
| Novo lead (`/leads/novo`) | OK | cria **Cliente** "QA-TEST Lead" (vendedor) — o form de lead gera contraparte |
| Nova oferta (`/ofertas/nova`) | OK | wizard 3 etapas, venda soja 500sc @130, status aberta |
| Novo alerta (`/alertas`) | OK | soja > 130, status ativo |
| Enviar proposta (detalhe) | OK | status→enviada, `enviadaEm` gravado |
| Kanban drag rascunho→Enviada | OK | abre modal "Enviar proposta ao cliente?" (e-mail documental); Cancelar não muda status |

## 🐛 Bugs encontrados

### BUG-1 (corrigido nesta sessão) — Mensagem de erro de login enganosa
- **Sintoma:** rate-limit (e 2FA) exibem **"Email ou senha inválidos"** em vez da mensagem real.
- **Causa:** next-auth v5 beta.31 empacota `throw new Error()` do `authorize` como
  `CallbackRouteError` → cliente recebe `error='Configuration'`, a mensagem se perde.
  O frontend (`page.tsx`) checava `errMsg.includes('muitas tentativas')` — nunca casava.
  O fix anterior `6ed1e8d` partiu de premissa errada ("mensagem preservada em res.error").
- **Fix aplicado:** subclasses de `CredentialsSignin` com `code` (`rate_limit`,
  `2fa_required`, `2fa_invalid`) em `auth.config.ts`; frontend lê `result.code` em
  `app/auth/login/page.tsx` e `app/_landing/SecretAdminPortal.tsx`. `tsc` 0 erros.
  **Pendente: deploy via @devops.**

### BUG-2 (corrigido nesta sessão) — Botão "Salvar Mudanças" morto na edição de proposta
- **Sintoma:** em `/propostas/[id]/editar`, "Salvar Mudanças" não dispara request
  nenhuma (nenhum PUT na rede); edição não persiste (`atualizadaEm` == `criadaEm`).
- **Causa:** `numero` é `disabled` mas o schema exigia `z.string().min(1)`; input
  disabled registra `undefined` no react-hook-form → `handleSubmit` bloqueia
  silenciosamente. Form também não era populado via `reset()`.
- **Fix aplicado:** `numero` → `z.string().optional()` + `reset(data)` no fetch em
  `app/propostas/[id]/editar/page.tsx`. `tsc` 0 erros. **Pendente: deploy via @devops.**

### BUG-3 (corrigido nesta sessão) — Autofill de CNPJ gera telefone inválido
- **Sintoma:** lookup de CNPJ preenchia o telefone como `(51) X / (51) Y` (dois
  números), que o validador `isValidPhone` (exige 10-11 dígitos) rejeita, travando
  o submit do cadastro de cliente.
- **Fix aplicado:** helper `normalizarTelefone()` em `lib/br/receitaws.ts` extrai só
  o primeiro número e descarta se não tiver 10-11 dígitos. Aplicado nas duas fontes
  (BrasilAPI `ddd_telefone_1` e ReceitaWS `telefone`). Testes unitários cobrem o caso.
  **Pendente: deploy via @devops.**

### BUG-4 (corrigido nesta sessão) — 404 em `/clientes/<id>/portal`
- **Sintoma:** link "criar acesso" na listagem `/clientes` apontava para
  `/clientes/<id>/portal`, rota **inexistente** → 404 (prefetch RSC poluía console).
- **Causa:** o fluxo real de convite ao portal está na aba de documentos do cliente
  (`POST /api/clientes/<id>/convidar-portal`, botão "Convidar para portal"), não numa
  página `/portal` dedicada.
- **Fix aplicado:** link "criar acesso" agora aponta para `/clientes/<id>/documentos`
  (`app/clientes/page.tsx`). Aba validada em produção: carrega 0 erros, botão presente.
  **Pendente: deploy via @devops.**

## ⚠️ Observações (não-bugs)
- **Workspace ativo divergente:** header mostra "Gustavo (Aero)", mas proposta/alerta
  foram gravados no workspace "Mercograin Trading" (`cmp1qq6y6...`). Conferir qual é o
  workspace ativo real do admin vs. o exibido.
- `/boletos/novo` direto fica em "Carregando contrato…" — boleto exige contrato de
  origem (não é avulso). Esperado.
- "Criar contrato" não tem botão na proposta em rascunho; surge pós-aceite.
- Form de `/leads/novo` cria um **Cliente** (não um registro `Lead`).

## 🧹 Limpeza executada (política: desativar, não deletar)
- Clientes `QA-TEST Cliente Browser` e `QA-TEST Lead` → `ativo=false`
- Proposta `MER2026061001P` → `cancelada`
- Oferta `QA-TEST Oferta smoke` → `cancelada`
- Alerta soja>130 → `inativo`
- Usuário sintético `qa.browser@mercograin.com` (criado p/ diagnóstico) → deletado
