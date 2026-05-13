# BH Grain — Variáveis de ambiente necessárias

Liste cada uma no painel Railway (ou `.env.local` em dev).

## Obrigatórias

| Variável | Propósito | Como gerar | Bloqueia o quê se faltar? |
|---|---|---|---|
| `DATABASE_URL` | Postgres com pooling | (já existente) | Tudo |
| `DIRECT_URL` | Postgres direto p/ migrations | (já existente) | Migrations |
| `NEXTAUTH_URL` | URL base pública do app | `https://app.bhgrain.com.br` | Auth + provision WhatsApp |
| `NEXTAUTH_SECRET` | Assinatura de sessão | `openssl rand -hex 32` | Auth |
| **`AI_MASTER_KEY`** | Cripto AES-256-GCM (BYOK + credenciais BH Grain) | `openssl rand -hex 32` (32 bytes hex) | `/configuracoes/integracoes` (qualquer save), `wire-whatsapp` BYOK |
| **`CRON_SECRET`** | Bearer token dos 4 endpoints `/api/cron/bhgrain-*` | `openssl rand -hex 24` | **Todos os crons BH Grain** retornam 401 |

## Opcionais (mas recomendadas)

| Variável | Propósito | Fallback se faltar |
|---|---|---|
| `OPENAI_API_KEY` | Classificação IA central (managed) | Cai na heurística pura — funciona, só fica menos preciso |
| `BHGRAIN_AI_MODEL` | Override do modelo OpenAI | `gpt-4o-mini` |
| `EMAIL_FROM` | Remetente padrão Resend | `BH Grain <noreply@profitsync.ia.br>` |
| `RESEND_API_KEY` | API key Resend (envio email) | Notificação de alerta crítico falha silenciosa |
| `NEXT_PUBLIC_APP_URL` | URL pública (alternativa a `NEXTAUTH_URL`) | Usa `NEXTAUTH_URL` |

## Validar config

```bash
# Local
echo $AI_MASTER_KEY | wc -c     # deve ser 65 (64 hex chars + \n)
echo $CRON_SECRET | wc -c        # 25+ chars

# Testar um cron manualmente
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://app.example.com/api/cron/bhgrain-health
# Esperado: {"ok":true,"workspaces":N,"checks":M}
```

## Crons BH Grain — agendamento

Ver `docs/bhgrain-crons.md`. Sem scheduler, os 4 endpoints existem mas nada os dispara.

## Feature flag global

A funcionalidade BH Grain é gated por `SystemConfig.bhgrain.v1`. Ligar via SQL:

```sql
INSERT INTO "SystemConfig" (key, value, "updatedAt")
VALUES ('bhgrain.v1', '{"enabled": true}'::jsonb, NOW())
ON CONFLICT (key) DO UPDATE SET value = '{"enabled": true}'::jsonb, "updatedAt" = NOW();
```

(Já aplicado no DB de produção atual.)
