# BH Grain — Crons

Os 4 endpoints abaixo são agendados via **GitHub Actions**
(`.github/workflows/cron-bhgrain-*.yml`) — mesmo padrão dos demais crons do
projeto (`cron-price-alerts.yml`, etc).

**Pré-requisito:** secret `CRON_SECRET` no repositório GitHub
(`Settings → Secrets and variables → Actions`). Valor deve bater com a env
`CRON_SECRET` no Railway. ✅ Railway production já tem (64 chars).

| Endpoint | Frequência sugerida | Função |
|---|---|---|
| `POST /api/cron/bhgrain-health` | a cada 10–15 min | Popula `IntegrationHealth` (probes WhatsApp/Email/IG/Portal/Preços/IA/Financeiro) |
| `POST /api/cron/bhgrain-alertas` | a cada 30 min | Gera `CommercialAlert` (cotação vencida, margem baixa, concentração, meta em risco, propostas paradas) |
| `POST /api/cron/bhgrain-financeiro` | a cada 1 hora | Materializa previsão de receita ponderada como `MovimentoFinanceiro` |
| `POST /api/cron/bhgrain-email-fetch` | a cada 5–10 min (em horário comercial) | IMAP fetch dos workspaces com credencial enabled. Popula `Conversation(channel='email')` |

## Auth

Todos os crons exigem header `Authorization: Bearer ${CRON_SECRET}`. Defina `CRON_SECRET` no ambiente.

## Como agendar (3 opções)

### Opção A — Railway: Cron Service externo

Railway não tem cron nativo no Web Service. Crie um **separate service** ou use o serviço externo abaixo.

### Opção B — Vercel (se migrar)

Criar `vercel.json` na raiz:

```json
{
  "crons": [
    { "path": "/api/cron/bhgrain-health", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/bhgrain-alertas", "schedule": "*/30 * * * *" },
    { "path": "/api/cron/bhgrain-financeiro", "schedule": "0 * * * *" },
    { "path": "/api/cron/bhgrain-email-fetch", "schedule": "*/10 * * * *" }
  ]
}
```

Vercel cron usa `Authorization: Bearer ${CRON_SECRET}` automaticamente se você definir a env.

### Opção C — Cron externo (GitHub Actions, EasyCron, cron-job.org)

Exemplo GitHub Actions `.github/workflows/bhgrain-crons.yml`:

```yaml
name: BH Grain Crons
on:
  schedule:
    - cron: "*/10 * * * *"  # health
    - cron: "*/30 * * * *"  # alertas
    - cron: "0 * * * *"     # financeiro
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://app.example.com/api/cron/bhgrain-health
          curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://app.example.com/api/cron/bhgrain-alertas
          curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://app.example.com/api/cron/bhgrain-financeiro
```

### Opção D — Disparo manual (válido para teste)

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://app.example.com/api/cron/bhgrain-health
```

## Comportamento

- **Idempotente** — pode disparar várias vezes sem efeito colateral
- **Skip se flag off** — respeitam `SystemConfig.bhgrain.v1 = { enabled: false }` retornando `{ skipped: true }`
- **Tolerante a falha** — erro em um workspace não para o batch dos outros
