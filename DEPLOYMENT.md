# Deployment no Railway

## Variáveis de Ambiente Obrigatórias

Adicione estas variáveis no dashboard do Railway → Seu Projeto → Web Service → Variables:

```
DATABASE_URL=postgresql://postgres:pFYvuLgeJExqaTnzUylsJLOaAUeXJWWQ@postgres.railway.internal:5432/railway
NEXTAUTH_SECRET=TdEtQjDYUnnjCS7o5+L2EDz6sSs7nr6T7GsS87PmdbY=
NEXTAUTH_URL=https://web-production-fd4af.up.railway.app
TRADINGVIEW_WEBHOOK_SECRET=S2b3aWTBvMYKFryreZplx3aKDCAFRLdVm+2lCUk2ArQ=
NODE_ENV=production
```

## Setup no Dashboard

1. Abra https://railway.app
2. Selecione seu projeto `mercograin-production`
3. Clique no serviço `web-production`
4. Vá para aba **Variables**
5. Copie e cole cada variável acima
6. Clique em **Save**

## Primeiro Deploy

Após adicionar as variáveis:
1. O Railway fará rebuild automaticamente
2. As migrations Prisma rodarão automaticamente (via entrypoint.sh)
3. A aplicação iniciará em https://web-production-fd4af.up.railway.app

## Credenciais de Acesso

- **Email (padrão):** admin@mercograin.com
- **Senha (padrão):** Admin@123456

Crie sua própria conta em /auth/signup após o primeiro login.

## Troubleshooting

Se vir erro de banco de dados:
1. Verifique que DATABASE_URL está definido
2. Veja os logs: Railway Dashboard → Seu Projeto → Logs
3. As migrations devem rodar na primeira inicialização
