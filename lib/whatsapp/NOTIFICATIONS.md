# Notificações WhatsApp automáticas

Sistema usa Evolution API (`lib/whatsapp/evolution.ts`) para enviar mensagens.
Notificações automáticas são disparadas pelo helper `notificarPorWhats()`
em `lib/whatsapp/notificar.ts`.

## Quando dispara

| Evento | Endpoint que aciona | Destinatário | Template |
|--------|--------------------|--------------| -------|
| Proposta enviada | `POST /api/bhgrain/propostas/[id]/enviar` | Cliente (`Cliente.whatsapp`) | `whatsPropostaEnviada` |
| Proposta aceita no portal | `POST /api/portal/propostas/[id]/aceitar` | Vendedor + Gerente (`WorkspaceMember.telefoneWhats` ou `User.telefone`) | `whatsPropostaAceita` |
| Contrato auto-gerado | Chamado de `criarContratoAutoFromProposta` (callers: aceite portal + aprovação interna) | Cliente (`Cliente.whatsapp`) | `whatsContratoGerado` |

## Critérios para envio

Para qualquer evento, **todos** os critérios precisam ser verdadeiros:

1. Workspace tem `WhatsAppInstance` com `status='connected'`.
2. Destinatário tem telefone cadastrado (não vazio, >=10 dígitos).
3. Variável de ambiente `DISABLE_WHATSAPP_AUTO_NOTIF` **não** está setada para `true`/`1`/`yes`.

Se qualquer um falhar, `notificarPorWhats` retorna `{ enviado: false, motivo: ... }`
sem propagar erro. Aplicação não regride status.

## Como desligar (operacional)

### Desligar para todos os workspaces
```bash
DISABLE_WHATSAPP_AUTO_NOTIF=true
```

### Desligar para um workspace específico
Desconecte a instância WhatsApp daquele workspace via `/whatsapp/instancia`.
Notificações param automaticamente.

### Desligar só uma categoria
Atualmente todos os 3 eventos estão sempre ligados quando a instância está
conectada. Se precisar de granularidade, será necessário adicionar uma tabela
`WorkspaceNotifSettings` futura — não foi implementada para evitar migration.

## Audit

Cada disparo registra em `WebhookLog`:
- `tipo: 'whatsapp_send_auto'`
- `payload.categoria`: `proposta_enviada_cliente` | `proposta_aceita_time` | `contrato_gerado_cliente`
- `status`: `processado` ou `erro`
- `payload.workspaceId`, `payload.number`, `payload.messageId` ou `payload.error`

## Templates

Definidos em `lib/whatsapp/templates/index.ts`. Todos usam emoji + `*negrito*`
do WhatsApp (sem HTML). Limite informal: ≤ 500 caracteres por mensagem.

Para mudar a redação, edite os templates; eles são puros (sem side effects)
e podem ser testados isoladamente.
