# Evolution API — WhatsApp grátis (central)

Servidor único hospedado por **vocês (Mercograin)**, compartilhado entre todos os
clientes do BH Grain. Cada cliente cria uma **instance** (conexão WhatsApp) via
QR Code direto no `/configuracoes/integracoes`.

## Custo aproximado

- Railway shared CPU 1GB RAM: ~**US$ 5/mês** (R$ 25)
- Suporta ~50 instâncias WhatsApp simultâneas (~50 clientes ativos no mesmo serviço)

## Provisionamento na Railway (clique-a-clique)

### 1. Adicionar o serviço

No **Railway → projeto "PHB Grain"**:

1. Botão **"+ New"** → **Empty Service** (ou "Deploy a template" se preferir)
2. Em **Source**: cole a imagem Docker:
   ```
   atendai/evolution-api:latest
   ```
3. Nome do serviço: `evolution-api`

### 2. Configurar variáveis de ambiente

Em **Variables**, adicione (copy-paste todas de uma vez no editor):

```env
# Identificação
SERVER_TYPE=http
SERVER_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}

# Auth — gere com `openssl rand -hex 32`
AUTHENTICATION_API_KEY=COLE_AQUI_UMA_KEY_RANDOMICA_DE_32_BYTES

# Database — reusa o Postgres já existente do projeto
# Adiciona schema dedicado para isolar do app
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=${{Postgres.DATABASE_URL}}?schema=evolution
DATABASE_CONNECTION_CLIENT_NAME=evolution_exchange
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true

# Storage local (sem S3) — Railway volume é opcional
STORE_MESSAGES=true
STORE_MESSAGE_UP=true
STORE_CONTACTS=true
STORE_CHATS=true

# Webhook global — TODA mensagem cai aqui no BH Grain
WEBHOOK_GLOBAL_URL=https://www.profitsync.ia.br/api/whatsapp/webhook/evolution
WEBHOOK_GLOBAL_ENABLED=true
WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false
WEBHOOK_EVENTS_MESSAGES_UPSERT=true
WEBHOOK_EVENTS_QRCODE_UPDATED=true
WEBHOOK_EVENTS_CONNECTION_UPDATE=true
WEBHOOK_EVENTS_SEND_MESSAGE=true

# Logs
LOG_LEVEL=info
LOG_COLOR=false

# CORS
CORS_ORIGIN=*
CORS_METHODS=GET,POST,PUT,DELETE
CORS_CREDENTIALS=true

# Cleanup automático
DEL_INSTANCE=false
DEL_TEMP_INSTANCES=true

# QR Code config
QRCODE_LIMIT=30
QRCODE_COLOR=#175197

# Cache local (sem Redis externo necessário)
CACHE_REDIS_ENABLED=false
CACHE_LOCAL_ENABLED=true

# Telemetry / Sentry
TELEMETRY=false
SENTRY_DSN=
```

### 3. Configurar Networking

1. **Settings → Networking**
2. **Generate Domain** → vai criar algo como `evolution-api-production-xxxx.up.railway.app`
3. Anote a URL completa (com `https://`)

### 4. Adicionar webhook secret no BH Grain principal

No serviço **web** do mesmo projeto Railway, adicionar:

```env
EVOLUTION_CENTRAL_URL=https://evolution-api-production-xxxx.up.railway.app
EVOLUTION_CENTRAL_API_KEY=<MESMA KEY que você gerou no AUTHENTICATION_API_KEY>
```

### 5. Esperar deploy

O primeiro deploy do Evolution leva ~3 minutos (build + migrations).
Em **Deployments → View Logs** acompanhe até ver:
```
[Evolution] HTTP server is running on port 8080
```

### 6. Verificação manual (curl)

```bash
curl https://evolution-api-production-xxxx.up.railway.app/manager \
  -H "apikey: $AUTHENTICATION_API_KEY"
```

Deve retornar 200 com lista de instâncias vazia.

## Como funciona depois

1. Cliente entra em `/configuracoes/integracoes`
2. Clica **"+ Adicionar WhatsApp"**
3. BH Grain chama `POST /instance/create` no Evolution central
   → cria instância nomeada `bhg-<workspaceId>-<random>`
4. Evolution retorna QR Code base64 que aparece num modal
5. Cliente escaneia com WhatsApp do celular
6. Evolution dispara `connection.update` no webhook global
7. BH Grain marca a credencial como `enabled: true` e salva `phoneNumber`
8. Mensagens recebidas chegam em `messages.upsert` no mesmo webhook
   → criam `Conversation(channel='whatsapp')` no banco do workspace correto

## Operação

- **Adicionar mais 1 cliente**: zero infra. Só criar nova instância via API.
- **Suporte a > 50 clientes**: subir RAM do serviço Evolution na Railway para 2GB (~US$ 10).
- **Backup**: tudo persiste em PostgreSQL — backups do banco já cobrem.
- **Disconnect de um cliente**: `DELETE /instance/delete/<instanceName>` (UI faz isso).

## Troubleshooting

| Sintoma | Causa provável | Fix |
|---|---|---|
| QR code não aparece | Evolution não conseguiu se conectar ao DB | Checar `DATABASE_CONNECTION_URI` (schema deve ter `?schema=evolution`) |
| Mensagens não chegam no Inbox | `WEBHOOK_GLOBAL_URL` errado ou app fora do ar | Logs do Evolution → procurar `[Webhook] error` |
| "Instance already exists" | Cliente clicou duas vezes em criar | UI deve deletar antes de recriar; se travou: `DELETE /instance/delete/<name>` direto via curl |
| 401 em todas as requests | `AUTHENTICATION_API_KEY` divergente entre Evolution e BH Grain | Re-copiar a key dos dois lados |

## Por que Evolution e não API oficial Meta

- **Meta Cloud API**: $0,005 por mensagem (~US$ 5 / 1000 msg), aprovação demorada,
  templates pré-aprovados obrigatórios para iniciar conversa.
- **Evolution + Baileys**: 100% gratuito, conecta via QR Code (como WhatsApp Web),
  zero aprovação, qualquer texto livre. Risco: política do WhatsApp pode banir
  números que enviam muito broadcast — mitigamos com rate-limit dentro do BH Grain.
