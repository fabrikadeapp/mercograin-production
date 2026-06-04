# Email Deliverability — profitsync.ia.br

> Documento operacional: garantir que emails transacionais (assinatura de contrato,
> reset de senha, confirmações) **não caiam no spam**.
>
> Última auditoria: 2026-06-04.

---

## 1. Diagnóstico atual

Comandos rodados:

```bash
dig +short NS profitsync.ia.br
# ns1.locaweb.com.br / ns2.locaweb.com.br / ns3.locaweb.com.br

dig +short TXT profitsync.ia.br
# (vazio — SEM registro SPF)

dig +short TXT resend._domainkey.profitsync.ia.br
# p=MIGfMA0GCSqGSIb3DQEBAQUA... (DKIM Resend EXISTE)

dig +short TXT _dmarc.profitsync.ia.br
# "v=DMARC1; p=none;"  (DMARC em modo aprendizado, sem rua)
```

| Registro | Estado | Impacto |
|---|---|---|
| MX | herda padrão Locaweb (não checado, fora do escopo) | irrelevante para envio |
| **SPF (TXT raiz)** | ❌ AUSENTE | **principal causa de spam** |
| DKIM `resend._domainkey` | ✅ presente | bom |
| DMARC | ⚠️ presente mas sem `rua=` e `p=none` | tolerante demais |
| Domínio verificado no Resend | ⚠️ verificar no dashboard | obrigatório |
| `EMAIL_FROM` no Railway | `BH Grain <noreply@profitsync.ia.br>` | OK assumindo domínio verificado |

**Resultado prático**: Gmail/Outlook reprovam o SPF check porque não existe TXT começando
com `v=spf1`. Sem SPF, o DMARC fica em quarentena efetiva e o email cai em spam
mesmo com DKIM válido.

---

## 2. O que adicionar no DNS (Locaweb)

Painel: `https://painel.locaweb.com.br/` → DNS → Zona profitsync.ia.br.

### 2.1 SPF (TXT raiz) — CRÍTICO

| Campo | Valor |
|---|---|
| Tipo | TXT |
| Host/Nome | `@` (ou em branco, raiz do domínio) |
| Conteúdo | `v=spf1 include:_spf.resend.com ~all` |
| TTL | 3600 |

> Se já existir algum TXT na raiz, **NÃO crie um segundo** — junte tudo num único
> registro. Não pode ter mais de um SPF por domínio.

### 2.2 DKIM (já existe)

Confirme no dashboard Resend → Domains → profitsync.ia.br que o registro
`resend._domainkey` está como **Verified**. Se aparecer "Pending", aguarde até 48h
ou clique em Verify.

### 2.3 DMARC — endurecer

Substituir o atual `"v=DMARC1; p=none;"` por:

| Campo | Valor |
|---|---|
| Tipo | TXT |
| Host/Nome | `_dmarc` |
| Conteúdo | `v=DMARC1; p=quarantine; rua=mailto:dmarc@profitsync.ia.br; ruf=mailto:dmarc@profitsync.ia.br; pct=100; aspf=r; adkim=r` |
| TTL | 3600 |

Significado:
- `p=quarantine`: emails sem SPF/DKIM caem em spam (não rejeita direto — seguro)
- `rua`: agregados diários (vai exigir criar caixa `dmarc@profitsync.ia.br`)
- `ruf`: relatórios forenses
- `pct=100`: aplica a 100% do tráfego
- `aspf=r adkim=r`: alinhamento relaxado (permite `mail.profitsync.ia.br` validar
  `profitsync.ia.br`)

> Depois de 30 dias monitorando os relatórios sem rejeição inesperada, subir para
> `p=reject`.

### 2.4 BIMI (opcional, futuro)

Após DMARC `p=quarantine` ou `p=reject` consolidado, configurar BIMI para mostrar
o logo da marca no Gmail/Yahoo. Requer logo SVG no padrão e (Gmail) certificado VMC pago.

---

## 3. Resend dashboard — checklist

1. Abrir https://resend.com/domains
2. Localizar `profitsync.ia.br`. Se não existir, **Add Domain** → digitar
   `profitsync.ia.br` → escolher região `sa-east-1` (São Paulo) se disponível.
3. Resend mostra 3 registros DNS:
   - `MX` (envio reverso, opcional)
   - `TXT @ v=spf1 include:_spf.resend.com ~all` (vide §2.1)
   - `TXT resend._domainkey p=MIG...` (vide §2.2 — já existe)
4. Adicionar os ausentes na Locaweb (§2).
5. Clicar **Verify Domain** no Resend após 10-30min de propagação.
6. Quando status = **Verified**, o domínio está liberado.

---

## 4. Variáveis do projeto (Railway)

Conferir no Railway → projeto PHB Grain → service `web`:

```
EMAIL_FROM=BH Grain <noreply@profitsync.ia.br>
RESEND_API_KEY=re_xxx... (chave do Resend)
```

Recomendação: separar endereço por finalidade para facilitar reputação:

```
EMAIL_FROM_ASSINATURA=BH Grain Assinaturas <assinaturas@profitsync.ia.br>
EMAIL_FROM_AUTH=BH Grain <noreply@profitsync.ia.br>
EMAIL_FROM_NOTIF=BH Grain Avisos <avisos@profitsync.ia.br>
```

> Hoje `lib/email-service.ts` lê apenas `EMAIL_FROM`. Implementação por-tipo é
> trabalho futuro (não crítico para sair do spam).

---

## 5. Validação pós-mudança

Depois de adicionar os registros e aguardar propagação (até 1h normalmente):

```bash
# 1. SPF presente
dig +short TXT profitsync.ia.br | grep "v=spf1"

# 2. DKIM presente
dig +short TXT resend._domainkey.profitsync.ia.br | head -1

# 3. DMARC endurecido
dig +short TXT _dmarc.profitsync.ia.br
```

Os 3 devem retornar conteúdo.

### Teste real de inbox

Mandar email teste para 3 caixas diferentes e verificar header `Authentication-Results`:

```
Authentication-Results: mx.google.com;
  dkim=pass header.i=@profitsync.ia.br;
  spf=pass (google.com: domain of bounces+...@profitsync.ia.br) smtp.mailfrom=...;
  dmarc=pass (p=QUARANTINE sp=NONE dis=NONE) header.from=profitsync.ia.br
```

Os 3 devem dar `pass`. Se algum der `fail` ou `none`, voltar ao §2.

Ferramentas externas para sanity check:
- https://www.mail-tester.com/ (mandar email, recebe nota 0-10; alvo: ≥ 9)
- https://mxtoolbox.com/spf.aspx
- https://mxtoolbox.com/dmarc.aspx

---

## 6. Warm-up de reputação

Domínio novo no Resend começa com IP de baixa reputação. Mesmo com SPF/DKIM/DMARC
perfeitos, primeiros emails podem ir para spam. Mitigação:

- **Dias 1-3**: enviar ≤ 20 emails/dia, pedir destinatários para marcar "Não é spam"
  e mover para inbox.
- **Dias 4-14**: 50-100 emails/dia.
- **Dias 15+**: volume normal.
- Resend ajusta automaticamente o IP pool dedicado conforme volume cresce.

Para acelerar: criar campanha controlada — mandar para usuários internos primeiro
(você, sócios, equipe) e fazer eles marcarem como "Não é spam" e mover para inbox.

---

## 7. Higiene contínua

- **Bounces**: monitorar painel Resend → Bounces. Soft bounce >5% ou hard bounce
  >2% = problema. Remover endereços inválidos da lista.
- **Spam complaints**: alvo < 0,1%. Acima disso, Gmail/Outlook bloqueiam progressivamente.
- **Unsubscribe**: todo email transacional deve ter rota de contato ("dúvidas?
  responda este email"). Marketing/em massa exige `List-Unsubscribe` header
  (não aplicável a transacional).
- **Conteúdo**: evitar gatilhos de spam — `URGENTE`, `GRÁTIS`, excesso de
  pontos de exclamação, links encurtados, imagens sem ALT.

---

## 8. Quando portar para outro projeto

Esse documento é reusável para Treko, Laura.IA, condomínio etc. Apenas trocar:
- `profitsync.ia.br` → domínio do projeto
- `_spf.resend.com` → conforme provider (Resend, SES, Sendgrid)
- `EMAIL_FROM` no projeto
- DNS provider (Locaweb / Registro.br / Cloudflare / Route53)

O fluxo (SPF + DKIM + DMARC + verificação no provider + warm-up) é universal.

---

## Apêndice — Comandos rápidos

```bash
# Audit completo
for r in TXT MX; do
  echo "=== $r ==="
  dig +short $r profitsync.ia.br
done
dig +short TXT _dmarc.profitsync.ia.br
dig +short TXT resend._domainkey.profitsync.ia.br

# Testar Resend via curl (precisa RESEND_API_KEY local)
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "BH Grain <noreply@profitsync.ia.br>",
    "to": "seu@email.com",
    "subject": "Teste deliverability",
    "html": "<p>Se este email cair no inbox, está OK.</p>"
  }'
```
