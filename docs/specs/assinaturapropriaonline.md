# Assinatura Própria Online — Spec Reusável

> **Status:** v1.0 · **Última atualização:** 2026-06-04
> **Origem:** Implementada inicialmente no Mercograin (corretora de grãos).
> **Destino:** Copiar para outros projetos que precisem de assinatura
> eletrônica conforme **Lei 14.063/2020** (assinatura simples), evitando
> dependência de Zapsign/Clicksign/D4Sign.
>
> **Projetos que devem reusar este padrão:**
> - **treko** (gestão de cargas/fretes)
> - **Laura.IA** (assistente comercial agro)
> - **gestão de condomínio** (documentos de inquilinato/regimento)
> - novos SaaS B2B com necessidade de aceite formal de documentos
>
> **Disclaimer jurídico:** este documento descreve a arquitetura técnica e
> as principais práticas LGPD. Não substitui consultoria jurídica
> específica para o caso de uso de cada produto.

---

## 1. O que é (e o que não é)

### É

- **Assinatura eletrônica simples** conforme Lei 14.063/2020 art. 4º, I.
- **Aceite formal** via clique consciente após leitura do documento.
- **Trilha de auditoria** com IP, user-agent, timestamp, hash SHA-256 do
  PDF, geolocalização opcional.
- **PDF final lacrado** com página de evidências automaticamente anexada.
- **Suficiente** para contratos comerciais B2B, termos de uso, política de
  privacidade, regimentos internos, autorizações de débito automático,
  recibos, NDAs simples.

### Não é

- **Assinatura qualificada com ICP-Brasil** — para isso use SerproID,
  ValidCertificadora, Bry, ou integre Clicksign/Zapsign Premium.
- **Reconhecimento facial** — não cobre selfie + foto do documento.
- **Em conformidade total para casos críticos** — para procurações,
  escrituras públicas, atos cartoriais, contratos de alto valor
  imobiliário ou operações que envolvem terceiros vulnerados (idosos,
  PCD), recomenda-se assinatura qualificada.

### Quando usar este padrão

| Caso | Vale a pena? |
|------|--------------|
| Contrato B2B comum (compra/venda, prestação serviço) | ✅ Sim |
| Termo de uso / política de privacidade | ✅ Sim |
| Aceite de proposta comercial | ✅ Sim |
| Regimento de condomínio (assinatura voluntária) | ✅ Sim |
| Autorização de débito automático (CCB simples) | ✅ Sim |
| Procuração ad judicia | ❌ Não — exige cartório ou ICP-Brasil |
| Escritura de imóvel | ❌ Não — exige cartório |
| Testamento | ❌ Não — exige forma específica |

---

## 2. Arquitetura

### Fluxo de alto nível

```
1. Staff envia documento pra assinatura
   └─→ POST /api/[dominio]/enviar-assinatura
        ├─ Gera 1 token JWT-like HMAC por signatário
        ├─ TTL: 30 dias por default (configurável)
        ├─ Cria registro AssinaturaDigital com providerNome='native'
        └─ Dispara notificação (email + WhatsApp) com link

2. Signatário recebe link e abre
   └─→ GET /assinar/[token]   (público, sem auth)
        ├─ Valida token HMAC + TTL
        ├─ Verifica não revogado
        ├─ Renderiza preview do PDF
        └─ Mostra form: nome + CPF/CNPJ + checkbox "Li e concordo"

3. Signatário confirma
   └─→ POST /api/assinar/[token]
        ├─ Re-valida token
        ├─ Captura IP (x-forwarded-for), UA, geo opcional
        ├─ Marca signatário como assinado em AssinaturaDigital.signatarios
        ├─ Se TODOS assinaram:
        │   ├─ status = 'assinado'
        │   ├─ Gera PDF final com página extra de evidências
        │   ├─ Calcula SHA-256 do PDF final
        │   └─ Notifica staff (email + WhatsApp)

4. Staff pode revogar antes de qualquer assinatura
   └─→ POST /api/contratos/[id]/assinatura/revogar
        ├─ Marca AssinaturaDigital.status = 'cancelado'
        ├─ Tokens viram inválidos
        └─ Audit log
```

### Dados sensíveis e onde ficam

| Campo | Onde fica | Retenção |
|-------|-----------|----------|
| Nome completo do signatário | `AssinaturaDigital.signatarios` (JSON) | Tempo de guarda do contrato (geralmente 5 anos pós-execução) |
| CPF/CNPJ | `AssinaturaDigital.signatarios` (JSON) — **só dígitos** | Idem |
| Email | `AssinaturaDigital.signatarios` (JSON) | Idem |
| Telefone (opcional) | `AssinaturaDigital.signatarios` (JSON) | Idem |
| IP de assinatura | `AssinaturaDigital.signatarios` (JSON) | Idem |
| User-Agent | `AssinaturaDigital.signatarios` (JSON, truncado 200 chars) | Idem |
| Geolocalização (opcional) | `AssinaturaDigital.signatarios` (JSON, lat/lng arredondado 4 casas) | Idem |
| Hash SHA-256 do PDF final | `AssinaturaDigital.pdfAssinadoHash` | Indefinido (prova de integridade) |
| Token de acesso | **NÃO** persistido — apenas HMAC com nonce, validável | TTL 30d |
| Hash do token | `AssinaturaDigital.signatarios[i].tokenHash` | TTL 30d |

---

## 3. Schema mínimo necessário

Reusar `AssinaturaDigital` existente quando possível. Para novo projeto:

```prisma
model AssinaturaDigital {
  id           String   @id @default(cuid())
  workspaceId  String   // multi-tenancy
  workspace    Workspace @relation(...)

  // Vínculo com o documento sendo assinado (proposta, contrato, termo, ...)
  documentoTipo String  @db.VarChar(40)  // 'contrato' | 'termo' | 'proposta' | ...
  documentoId   String

  providerNome  String  // 'native' (nosso) | 'zapsign' | 'clicksign' | ...
  providerDocId String  @unique  // ID interno (cuid quando native)

  authMode      String  @default("simple")  // 'simple' | 'sms' | 'email_token' | 'icp_brasil'

  status        String  @default("pendente")
  // 'pendente'  | 'parcial'   | 'assinado'  | 'recusado'  | 'expirado' | 'cancelado'

  enviadoEm     DateTime @default(now())
  finalizadoEm  DateTime?
  expiraEm      DateTime?

  // Array JSON com objetos {nome, cpfCnpj, email, telefone, tokenHash,
  // signedAt, ip, ua, geo, refusedAt, refusedReason}
  signatarios   Json

  pdfOriginalHash String?
  pdfAssinadoUrl  String?
  pdfAssinadoHash String?

  // Para revogação pelo staff antes da assinatura
  canceladoEm   DateTime?
  canceladoPorId String?
  canceladoMotivo String? @db.Text

  webhookSecret String?  // para integrações futuras

  createdAt DateTime @default(now())

  @@index([workspaceId, status])
  @@index([documentoTipo, documentoId])
}
```

---

## 4. Token nativo — geração e validação

### Formato

```
base64url(assinaturaId).base64url(signatorioIdx).base64url(nonce).base64url(expEpoch).base64url(hmac)
```

### Implementação (TypeScript, sem dependência)

```typescript
import crypto from 'crypto'

const SECRET = process.env.SIGNATURE_NATIVE_SECRET ||
               process.env.NEXTAUTH_SECRET ||
               'fallback-dev-only'

const DEFAULT_TTL_DAYS = 30

function b64url(buf: Buffer | string): string {
  return Buffer.isBuffer(buf)
    ? buf.toString('base64url')
    : Buffer.from(buf).toString('base64url')
}

export function gerarTokenAssinatura(
  assinaturaId: string,
  signatorioIdx: number,
  ttlDays = DEFAULT_TTL_DAYS,
): { token: string; tokenHash: string; expiraEm: Date } {
  const nonce = crypto.randomBytes(12).toString('base64url')
  const expiraEm = new Date(Date.now() + ttlDays * 86_400_000)
  const expEpoch = b64url(String(Math.floor(expiraEm.getTime() / 1000)))
  const idEncoded = b64url(assinaturaId)
  const idxEncoded = b64url(String(signatorioIdx))
  const data = `${idEncoded}.${idxEncoded}.${nonce}.${expEpoch}`
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  const token = `${data}.${sig}`
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return { token, tokenHash, expiraEm }
}

export function validarTokenAssinatura(token: string): {
  valid: boolean
  expirado: boolean
  assinaturaId: string
  signatorioIdx: number
  expiraEm: Date | null
} {
  const fail = {
    valid: false,
    expirado: false,
    assinaturaId: '',
    signatorioIdx: -1,
    expiraEm: null,
  }

  if (!token || typeof token !== 'string') return fail
  const parts = token.split('.')
  if (parts.length !== 5) return fail
  const [idEnc, idxEnc, nonce, expEpoch, sig] = parts

  const expectedSig = crypto
    .createHmac('sha256', SECRET)
    .update(`${idEnc}.${idxEnc}.${nonce}.${expEpoch}`)
    .digest('base64url')

  let valido = false
  try {
    const sigBuf = Buffer.from(sig, 'base64url')
    const expBuf = Buffer.from(expectedSig, 'base64url')
    valido = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)
  } catch {
    valido = false
  }
  if (!valido) return fail

  const assinaturaId = Buffer.from(idEnc, 'base64url').toString('utf8')
  const signatorioIdx = parseInt(Buffer.from(idxEnc, 'base64url').toString('utf8'), 10)
  const epoch = parseInt(Buffer.from(expEpoch, 'base64url').toString('utf8'), 10)
  if (!Number.isFinite(epoch) || !Number.isFinite(signatorioIdx)) return fail
  const expiraEm = new Date(epoch * 1000)
  const expirado = expiraEm.getTime() < Date.now()
  return { valid: !expirado, expirado, assinaturaId, signatorioIdx, expiraEm }
}
```

---

## 5. Página pública `/assinar/[token]`

### Requisitos UX

1. **Sem autenticação** — o token é a credencial.
2. **Preview do PDF visível** antes de assinar (iframe ou viewer leve).
3. **Form com 3 campos:**
   - Nome completo (texto, obrigatório, mínimo 5 chars)
   - CPF/CNPJ (só dígitos, validação Mod11)
   - Checkbox "Li e concordo com o documento acima" (obrigatório)
4. **Botão "Assinar agora"** desabilitado até todos os campos estarem ok.
5. **Termo de aceite explícito** visível antes do botão:
   > "Ao clicar em 'Assinar agora', você manifesta ciência e concordância
   > com todo o conteúdo do documento. Esta assinatura tem validade legal
   > conforme Lei 14.063/2020. Serão registrados seu IP, dispositivo e
   > horário para fins de auditoria."
6. **Feedback pós-assinatura:** página de confirmação com hash do PDF +
   protocolo de assinatura + botão para baixar PDF final.

### Comportamentos de erro

| Situação | Resposta |
|----------|----------|
| Token inválido (HMAC errado) | 403 com mensagem "Link inválido. Solicite novo envio." |
| Token expirado | 403 "Link expirado em DD/MM/YYYY. Solicite reenvio." |
| Assinatura já cancelada | 403 "Esta assinatura foi cancelada. Entre em contato." |
| Signatário já assinou | 200 com "Você já assinou este documento em DD/MM HH:MM." |

---

## 6. Captura de evidências

### O que coletar no `POST /api/assinar/[token]`

```typescript
const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
       ?? req.headers.get('x-real-ip')
       ?? null
const ua = req.headers.get('user-agent')?.slice(0, 200) ?? null
const acceptLanguage = req.headers.get('accept-language')?.slice(0, 80) ?? null
const signedAt = new Date()
```

### O que registrar no signatário

```json
{
  "nome": "Joao Silva",
  "cpfCnpj": "12345678900",       // só dígitos
  "email": "joao@example.com",
  "telefone": "5511999999999",     // E.164 sem +
  "tokenHash": "abc123...",         // SHA-256 do token (não o token)
  "signedAt": "2026-06-04T14:30:22Z",
  "ip": "200.180.50.10",
  "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
  "acceptLanguage": "pt-BR,pt;q=0.9,en;q=0.8",
  "geo": { "lat": -23.5505, "lng": -46.6333 }, // opcional, 4 casas
  "pdfHashAcessado": "sha256:abc..."  // hash do PDF que foi mostrado
}
```

### Importante para integridade

- **Hash do PDF deve ser capturado NO MOMENTO em que o signatário acessa**,
  não quando assina. Isso prova "ele viu exatamente este documento".
- Se o PDF for editado após o envio (não deve acontecer mas vale defesa),
  o hash da página de evidências divergirá e a assinatura fica auditável.

---

## 7. Página de evidências (anexada ao PDF final)

Quando o último signatário assina, regerar o PDF com **página extra**
ao final contendo:

```
┌────────────────────────────────────────────────────────────┐
│                   PÁGINA DE EVIDÊNCIAS                     │
│              Documento eletronicamente assinado            │
│                                                            │
│ Documento: Contrato MCG2026060401C                         │
│ Hash SHA-256 do conteúdo: 7a8b9c... (64 chars)             │
│ Total de signatários: 2                                    │
│ Finalizado em: 2026-06-04 14:32:11 UTC                     │
│                                                            │
│ ─────────────────────────────────────────────────────      │
│                                                            │
│ SIGNATÁRIO 1                                               │
│ Nome:        João Silva                                    │
│ CPF/CNPJ:    123.***.789-00 (mascarado para LGPD)          │
│ Email:       j***@example.com (mascarado)                  │
│ Assinado:    2026-06-04 14:30:22 UTC (-03:00)              │
│ IP:          200.180.50.10                                 │
│ Dispositivo: Mozilla/5.0 Macintosh Chrome/120              │
│ Localização: São Paulo/SP (aproximada, GPS)                │
│                                                            │
│ SIGNATÁRIO 2                                               │
│ Nome:        Maria Souza                                   │
│ ... (mesma estrutura)                                      │
│                                                            │
│ ─────────────────────────────────────────────────────      │
│                                                            │
│ Este documento foi assinado eletronicamente conforme       │
│ Lei nº 14.063/2020 (assinatura simples). A integridade do  │
│ documento pode ser verificada pelo hash SHA-256 acima      │
│ no sistema [PROJETO_NOME] em /verificar/[hash].            │
└────────────────────────────────────────────────────────────┘
```

**Mascaramento LGPD** na página de evidências visível:

- CPF: `123.***.789-00` (primeiro+último blocos visíveis)
- Email: `j***@example.com` (primeira letra + domínio)
- Telefone: `+55 11 9***-9999`

Os dados completos ficam em `AssinaturaDigital.signatarios` no banco e
só são acessíveis via consulta administrativa autenticada (com audit log
do acesso).

---

## 8. Notificações

### Quando staff envia para assinatura

**Para cada signatário** (email + WhatsApp se telefone informado):

```
Assunto: Documento aguardando sua assinatura — [PROJETO_NOME]

Olá [Nome],

A [Empresa] enviou um documento para sua assinatura eletrônica:

📄 [Tipo do documento] nº [Número]
🔒 Assinatura simples (Lei 14.063/2020)
⏰ Válido até [DD/MM/AAAA]

Para revisar e assinar, acesse:
[https://app.exemplo.com/assinar/{token}]

Esta assinatura tem validade legal. Seus dados (IP, navegador, horário)
serão registrados para auditoria conforme nossa Política de Privacidade.

Se você não esperava receber este documento, ignore este email e nos
avise em [contato@empresa.com].
```

### Quando todos assinaram

**Para staff que enviou** (email + WhatsApp):

```
Assunto: Documento [Número] foi assinado por todos — [PROJETO_NOME]

Olá [Vendedor],

✅ [Tipo] nº [Número] foi assinado por todos os signatários.

Resumo:
- Cliente: [Nome do Cliente]
- Signatários: [N] pessoas
- Finalizado em: [DD/MM/AAAA HH:MM]
- Hash de integridade: [primeiros 16 chars]

Baixar PDF final: [link]
Ver no sistema: [link]
```

---

## 9. Conformidade LGPD — o que documentar no produto

### Base legal para o tratamento

**Execução de contrato** (art. 7º, V da LGPD). Os dados coletados são
estritamente necessários para:

1. Identificar o signatário (nome, CPF/CNPJ)
2. Comprovar a vontade de contratar (timestamp, IP, UA, hash)
3. Comunicar o resultado (email, telefone)

### Direitos do titular

A Política de Privacidade do produto deve garantir ao signatário:

- **Acesso** aos dados de suas assinaturas (`/conta/minhas-assinaturas`)
- **Correção** de dados desatualizados (formulário simples)
- **Exclusão** após cumprimento do prazo legal de guarda (geralmente
  5 anos pós-execução do contrato para fins fiscais e civis — verificar
  por caso de uso)
- **Portabilidade** — exportar JSON com todas as assinaturas + PDFs

### Prazo de retenção

| Tipo de documento | Retenção sugerida |
|-------------------|-------------------|
| Contrato comercial B2B | 5 anos pós-término (CTN art. 174) |
| Termo de uso de SaaS | Enquanto contrato ativo + 5 anos |
| Recibos < R$ 1.000 | 6 meses |
| Aceite de cookies | 12 meses |
| Documento condominial | Enquanto vínculo ativo + 5 anos |

### O que NÃO armazenar

- ❌ Cópia de RG ou foto do documento (não usamos nessa modalidade)
- ❌ Senhas, biometria
- ❌ Dados sensíveis sobre saúde, orientação sexual, religião
- ❌ Dados de menores sem consentimento parental

### Audit log obrigatório

Cada acesso à assinatura concluída por staff deve registrar em audit:

- Quem acessou (userId)
- Quando (timestamp)
- Qual documento
- Justificativa (se for download massa, exige motivo)

---

## 10. Integração no projeto (checklist de instalação)

Ao copiar este padrão para um projeto novo (treko, Laura.IA, etc):

```
□ Adicionar AssinaturaDigital ao schema Prisma (se ainda não existe)
□ Criar migration manual_assinatura_digital.sql
□ Configurar SIGNATURE_NATIVE_SECRET no env (>= 32 chars)
□ Implementar lib/[dominio]/signature/native-token.ts (copiar de cima)
□ Implementar lib/[dominio]/signature/native.ts (provider)
□ Adicionar provider no factory de signature
□ Criar endpoint POST /api/[dominio]/enviar-assinatura
□ Criar endpoint GET  /api/assinar/[token]
□ Criar endpoint POST /api/assinar/[token]
□ Criar endpoint POST /api/[dominio]/assinatura/revogar
□ Criar página /assinar/[token] (pública, sem auth)
□ Criar página /assinar/[token]/concluido (recibo)
□ Implementar templates de email (envio + conclusão)
□ Implementar templates de WhatsApp (envio + conclusão)
□ Adicionar geração de página de evidências no pdf-service
□ Adicionar funções de mascaramento LGPD nos formatters
□ Atualizar Política de Privacidade do produto
□ Atualizar Termos de Uso (mencionar Lei 14.063/2020)
□ Adicionar /verificar/[hash] (endpoint público de integridade)
□ Treinar equipe sobre como acessar/revogar assinaturas
□ Testes de integração end-to-end
```

---

## 11. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Token vazado em logs | Não logar URL completa; mascarar token > 8 chars |
| Token usado em rede pública insegura | TLS obrigatório, HSTS, sem fallback HTTP |
| Signatário não viu o PDF inteiro antes de assinar | Forçar scroll até o final + tempo mínimo de leitura (opcional) |
| Bot/script automatizado assinando | Rate limit por IP no endpoint POST, captcha opcional |
| Disputa "não fui eu que assinei" | Hash do PDF + IP + UA + timestamp + tokenHash (que só estava no email/SMS do signatário) servem como prova de origem |
| PDF alterado após assinatura | pdfAssinadoHash imutável no DB + página de evidências carrega o hash → divergência detectável |
| Staff revoga depois que cliente já assinou | Status check antes de assinar; assinaturas concluídas não revogáveis |
| Workspace deletado mas guardamos PDF | Manter `AssinaturaDigital` em soft-delete pelo prazo legal mesmo se workspace for inativado |

---

## 12. Roadmap de evolução

Itens fora desta v1 que podem ser adicionados depois:

- **v1.1:** OTP por SMS/email antes de assinar (adicionar `authMode='sms'`)
- **v1.2:** Endpoint público `/verificar/[hash]` para terceiros validarem PDFs
- **v1.3:** Selfie + foto do documento (modo `authMode='facial'`)
- **v1.4:** ICP-Brasil via integração SerproID/ValidCertificadora
- **v2.0:** Suporte multi-documentos (assinar múltiplos PDFs num envio)
- **v2.1:** Assinatura por procuração (procurador assina em nome de PJ)

---

## Apêndice A — Glossário

- **AssinaturaDigital**: registro no DB representando o evento de coleta
  de assinatura de um documento.
- **Signatário**: pessoa física ou jurídica que assina o documento.
- **TokenHash**: SHA-256 do token, persistido para conferir sem expor o
  token em si.
- **Página de evidências**: página extra apensada ao PDF final com prova
  de quem, quando, onde e como assinou.
- **Provider nativo**: nosso próprio sistema de coleta de assinatura, sem
  Zapsign/Clicksign.

## Apêndice B — Referências legais

- Lei nº 14.063/2020 — uso de assinaturas eletrônicas em interações com
  entes públicos e privados.
- Decreto nº 10.543/2020 — regulamenta a lei.
- Lei nº 13.709/2018 (LGPD) — Lei Geral de Proteção de Dados Pessoais.
- MP 2.200-2/2001 — ICP-Brasil.
- CTN art. 174 — prazo de guarda de documentos fiscais.

---

— Documento mantido pela equipe de produto. Última revisão: 2026-06-04.
