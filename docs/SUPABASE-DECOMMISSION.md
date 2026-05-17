# Descomissionamento do Supabase

**Data da migração:** 2026-05-17
**Janela de fallback:** até 2026-05-24 (1 semana)

## O que aconteceu

A stack foi migrada inteira para Railway:

| Componente | Antes | Agora |
|---|---|---|
| Postgres | Supabase (aws-1-sa-east-1) | Railway Postgres (postgres.railway.internal:5432) |
| Storage | Supabase Storage (`phb-grain-uploads`) | Railway Volume `/data/uploads` |
| Auth | NextAuth próprio | NextAuth próprio (sem mudança) |

Migração: commit `6dc913e` em main.

## Por que manter Supabase ativo por 1 semana

- Rollback rápido se algum bug aparecer (basta restaurar `DATABASE_URL` antigo)
- Dump do dia 17/05 preservado em `/tmp/mercograin-20260517-131236.sql`
- Postgres novo ainda vai juntando dados — quanto mais tempo passa, mais
  arriscado é voltar atrás

## Como restaurar rollback (se necessário)

```bash
# 1. Trocar DATABASE_URL/DIRECT_URL no Railway
railway link --service web --environment production
railway variable set \
  "DATABASE_URL=<SUPABASE_DIRECT_URL_antigo>" \
  "DIRECT_URL=<SUPABASE_DIRECT_URL_antigo>"

# 2. Redeploy automático

# 3. Reverter commit do storage (storage local fica vazio, supabase fica como tava)
git revert 6dc913e
git push origin main
```

## Checklist para descomissionar Supabase (após 2026-05-24)

### Validação de que não há mais dependência
- [ ] Confirmar 7 dias sem incidentes em produção
- [ ] Verificar logs do Railway por erros de Postgres ou storage
- [ ] Confirmar com `grep -rn "supabase\.co\|SUPABASE" --include='*.ts'`
  que nenhum código novo voltou a usar Supabase

### Remoção de envs no Railway
```bash
railway link --service web --environment production
railway variable delete NEXT_PUBLIC_SUPABASE_URL
railway variable delete NEXT_PUBLIC_SUPABASE_ANON_KEY
railway variable delete SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_BUCKET_UPLOADS é só nome de diretório no volume — manter
# (ou renomear para STORAGE_BUCKET_NAME pra ficar coerente)
```

### Limpeza do código
- [ ] Remover dependência `@supabase/supabase-js` do package.json
  ```bash
  npm uninstall @supabase/supabase-js
  ```
- [ ] Apagar `lib/supabase/server.ts` e `lib/supabase/storage.ts`
  (depois de migrar callers pra `lib/storage/local` diretamente)
- [ ] Renomear `SUPABASE_BUCKET` → `STORAGE_BUCKET_NAME` em código

### Desligar Supabase
1. Apagar projeto no painel Supabase
2. Confirmar que nenhuma cobrança recorrente ficou pendurada
3. Cancelar plano se for o caso

## Custos esperados

| Item | Antes | Depois |
|---|---|---|
| Supabase Pro | $25/mês | $0 |
| Railway Postgres | $0 | incluso no plano atual |
| Railway Volume web (5GB) | $0 | incluso |
| **Total** | **~$30/mês** | **~$5/mês** (Railway plano base) |

Economia: ~$25/mês = ~$300/ano.

## Volumes órfãos da Railway (pendência manual)

Durante a migração, identifiquei **12 volumes Postgres órfãos** no projeto
(serviceName=null, ~13GB combinados). São de deploys anteriores de Postgres
que foram deletados sem limpar os volumes.

Tentei deletar via CLI (`railway volume delete --volume <ID> --yes`): o CLI
retorna "Volume deleted" mas o volume continua aparecendo na lista. Bug
conhecido da CLI ou volumes em quarentena.

**Ação necessária — manual no painel web:**
1. Railway dashboard → PHB Grain → Volumes
2. Identificar volumes com nome `postgres-volume-*` que NÃO sejam o
   `postgres-volume-TOm_` (atual)
3. Deletar manualmente cada um pelo painel (provavelmente exige confirmação 2FA)

Volumes a preservar:
- `postgres-volume-TOm_` (DB atual)
- `web-volume` (storage do app)

Custo dos órfãos: depende do plano Railway — em geral volumes parados não
cobram I/O mas ocupam quota de storage do plano.
