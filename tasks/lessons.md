# Lessons — MercoGrain / ProfitSync

> Padrões e armadilhas capturados durante o desenvolvimento. Revisar no início de cada sessão.

## Auth / NextAuth v5 (beta.31)

- **Erro lançado em `authorize()` NÃO preserva a mensagem no client.** Na next-auth
  v5 beta, qualquer `throw new Error('...')` dentro do `authorize` é empacotado como
  `CallbackRouteError`, e o `signIn(..., { redirect:false })` no client recebe
  `result.error === 'Configuration'` — **não** a mensagem original. Logo, checagens
  no frontend tipo `errMsg.includes('2FA_REQUIRED')` ou `'muitas tentativas'` nunca
  casam, e o usuário cai no fallback genérico ("Email ou senha inválidos").
  - **Forma idiomática correta:** criar subclasse de `CredentialsSignin` com a
    propriedade `code` (ex.: `class TwoFactorRequired extends CredentialsSignin { code = '2FA_REQUIRED' }`).
    O NextAuth expõe `code` ao client via `?code=` na URL de erro / `result.error`.
  - O comentário no `auth.config.ts` ("a mensagem é preservada em res.error") está
    **incorreto** para a beta.31 — premissa do commit `6ed1e8d` que não funcionou.
  - Referências: GitHub issues nextauthjs/next-auth #11190, #11074, #9900.

- **Rate limit de login é in-memory e por-email** (`rateLimit('login:email:<email>')`,
  5 tentativas / 15 min). Estoura por instância; não persiste após restart do serviço
  `web`. Tentativas de QA acumulam e bloqueiam o email-alvo temporariamente — usar um
  email de teste distinto OU aguardar a janela.

## Arquitetura de usuários / workspaces

- **Super-admin Mercograin** = `role='admin'` **sem** workspace. O middleware o
  redireciona só para `/admin`; sem 2FA, força `/perfil/seguranca/2fa?motivo=super_admin_exige_2fa`.
  Ele **não** acessa telas operacionais (`/clientes`, `/propostas`, etc.).
- `admin@mercograin.com` **tem** 2 workspaces (é owner) → NÃO é super-admin puro →
  loga normal e vai pro `/dashboard`. É o usuário operacional do QA.
- Para QA operacional, o usuário precisa ter workspace (owner ou membership ativa).

## Formulários (react-hook-form + Zod)

- **Input `disabled` + campo obrigatório no schema = submit morto.** Um input
  `disabled` registra `undefined` no react-hook-form; se o schema Zod exige
  `min(1)` nesse campo, o `handleSubmit` falha a validação **silenciosamente** e
  nunca chama o `onSubmit` (nenhuma request sai). Para campos read-only/imutáveis,
  use `.optional()` no schema e popule o form com `reset(data)` após o fetch.
- **Autofill de fontes externas pode injetar valores que o próprio form rejeita.**
  Normalizar na origem: a ReceitaWS devolve telefone como `(51) X / (51) Y` (dois
  números); o validador exige 10-11 dígitos. Extrair só o primeiro e descartar se
  inválido — ver `normalizarTelefone()` em `lib/br/receitaws.ts`.

## SSR / Hydration (Next.js App Router)

- **Formatar datas com `toLocaleString`/`toLocaleDateString` no JSX de um client
  component causa hydration mismatch** (React #418/#425/#423). O servidor (UTC no
  Railway) e o navegador (BRT) produzem strings diferentes → SSR ≠ CSR. Solução:
  formatar a data só no cliente (`useState('')` + `useEffect` que preenche após
  mount), mantendo o SSR estável. Visto em `/admin/metricas`.
- O React se recupera (#423) e a página renderiza, mas os erros poluem o console
  e indicam fragilidade — tratar, não ignorar.

## Scope / multi-tenant (super-admin)

- **Super-admin Mercograin não tem workspace → `getScope()` retorna null → 401**
  em qualquer API que dependa de workspace scope. Telas /admin que consomem APIs
  de workspace (corretores, mesas) ficam vazias. Padrão de correção seguro: conceder
  scope global SOMENTE para `isAdmin` + `?scope=all` + sem workspace; `whereOwn()`
  não filtra (lista tudo); manter POST exigindo workspace real. Nunca abrir o scope
  global sem o gate `isAdmin`.

## Auth do portal do produtor

- Auth do portal é SEPARADA do NextAuth: cookie próprio, modelo `ProdutorAccess`
  (`emailLogin` + `passwordHash` bcrypt). Login: `POST /api/portal/login`
  ({email, senha}), busca por `emailLogin`, valida `ativo` + `passwordHash`.
  URL de login: `/portal/<slug>/login`.

## Rotas / links

- Antes de criar um `<Link href>`, confirmar que a rota existe. O link "criar
  acesso" em `/clientes` apontava para `/clientes/<id>/portal` (inexistente → 404
  em prefetch RSC). O fluxo real de convite ao portal é a aba
  `/clientes/<id>/documentos` (`POST /api/clientes/<id>/convidar-portal`).

## Banco / Railway

- `DATABASE_URL` (interno `postgres.railway.internal`) e `DATABASE_PUBLIC_URL`
  (proxy `*.proxy.rlwy.net`) apontam para o **mesmo** Postgres (`db=railway`).
  Para scripts locais, usar `DATABASE_PUBLIC_URL`.
- Scripts Prisma ad-hoc precisam rodar **dentro** do diretório do projeto (para
  resolver `node_modules/@prisma/client`) e com `DATABASE_URL`/`DIRECT_URL` injetados
  a partir do `DATABASE_PUBLIC_URL` do Railway.
- `railway logs --service web` → logs da app Next.js. `railway logs` (linkado em
  Postgres) → logs do banco.
- Modelo `User`: campo de senha é `senha` (hash bcrypt), papel é `role`.
- Modelo `Workspace`: usa `name` e `codigo` (não `nome`/`slug`).
