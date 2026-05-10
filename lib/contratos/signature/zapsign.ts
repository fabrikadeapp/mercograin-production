/**
 * Adapter ZapSign — STUB pronto para produção.
 *
 * Endpoints:
 *   POST   https://api.zapsign.com.br/api/v1/docs/         — cria documento
 *   GET    https://api.zapsign.com.br/api/v1/docs/{token}/ — consulta status
 *   POST   https://api.zapsign.com.br/api/v1/docs/{token}/cancel/ — cancelar
 *   GET    {signed_file} (URL retornada na consulta)        — download PDF
 *
 * Header: Authorization: Bearer {ZAPSIGN_API_KEY}
 *
 * IMPORTANTE: Esta classe NÃO chama a API automaticamente.
 *  - Se ZAPSIGN_API_KEY não estiver configurada, isReady()=false e send/status/cancel
 *    lançam erro descritivo (caller deve fallback para Mock).
 *  - Quando a key estiver configurada, faz request real (não testaremos isso aqui).
 */
import crypto from 'crypto'
import type {
  AuthMode,
  SignatureProvider,
  SignaturePayload,
  SignatureResponse,
  SignatureStatus,
  SignatureStatusValue,
} from './types'

const API_BASE = 'https://api.zapsign.com.br/api/v1'

// ZapSign aceita: 'assinatura-eletronica' (simple) | 'certificado-digital' (icp)
// | 'sms-token' | 'email-token'
const AUTH_MAP: Record<AuthMode, string> = {
  simple: 'assinatura-eletronica',
  icp_brasil: 'certificado-digital',
  sms: 'sms-token',
  email_token: 'email-token',
}

function mapZapStatus(s?: string): SignatureStatusValue {
  switch ((s || '').toLowerCase()) {
    case 'signed':
      return 'assinado'
    case 'pending':
      return 'pendente'
    case 'partial':
    case 'partially-signed':
      return 'parcial'
    case 'refused':
    case 'rejected':
      return 'recusado'
    case 'expired':
      return 'expirado'
    case 'canceled':
    case 'cancelled':
      return 'cancelado'
    default:
      return 'pendente'
  }
}

export class ZapSignProvider implements SignatureProvider {
  name = 'zapsign'

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = API_BASE
  ) {}

  isReady(): boolean {
    return Boolean(this.apiKey)
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  async send(payload: SignaturePayload): Promise<SignatureResponse> {
    if (!this.isReady()) {
      throw new Error('ZAPSIGN_API_KEY não configurada')
    }

    // ZapSign aceita PDF via base64 (`base64_pdf`) ou URL pública (`url_pdf`).
    // Como o PDF está em memória no servidor, usamos base64.
    const base64Pdf = payload.pdfBuffer.toString('base64')

    const body = {
      name: `Contrato ${payload.contractNumber}`,
      base64_pdf: base64Pdf,
      external_id: payload.externalId || payload.contractId,
      lang: 'pt-br',
      disable_signer_emails: false,
      brand_logo: undefined as string | undefined,
      signers: payload.signatories.map((s) => ({
        name: s.name,
        email: s.email,
        phone_country: s.phone ? '55' : undefined,
        phone_number: s.phone,
        auth_mode: AUTH_MAP[s.authMode] ?? AUTH_MAP.simple,
        cpf: s.cpfCnpj.length <= 14 ? s.cpfCnpj : undefined,
        cnpj: s.cpfCnpj.length > 14 ? s.cpfCnpj : undefined,
        send_automatic_email: Boolean(s.email),
        send_automatic_whatsapp: Boolean(s.phone),
      })),
      ...(payload.webhookUrl ? { url_callback: payload.webhookUrl } : {}),
    }

    const res = await fetch(`${this.baseUrl}/docs/`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        providerDocId: '',
        signUrls: [],
        status: 'pendente',
        rawResponse: json,
        error:
          json?.message ||
          `ZapSign HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`,
      }
    }

    const token: string = json.token || json.open_id || ''
    const signers: any[] = Array.isArray(json.signers) ? json.signers : []
    const signUrls = signers.map((s) => ({
      signatoryEmail: s.email || s.cpf || s.cnpj || '',
      url: s.sign_url || s.url_signer || '',
    }))

    return {
      ok: true,
      providerDocId: token,
      signUrls,
      status: mapZapStatus(json.status),
      rawResponse: json,
    }
  }

  async status(providerDocId: string): Promise<SignatureStatus> {
    if (!this.isReady()) throw new Error('ZAPSIGN_API_KEY não configurada')

    const res = await fetch(`${this.baseUrl}/docs/${providerDocId}/`, {
      method: 'GET',
      headers: this.headers(),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(`ZapSign status HTTP ${res.status}`)
    }

    const signatories = (Array.isArray(json.signers) ? json.signers : []).map(
      (s: any) => ({
        cpfCnpj: s.cpf || s.cnpj || '',
        name: s.name || '',
        signedAt: s.signed_at ? new Date(s.signed_at) : null,
        refusedAt: s.rejected_at ? new Date(s.rejected_at) : null,
        authMode: 'simple' as AuthMode,
        ip: s.ip || undefined,
      })
    )

    return {
      providerDocId,
      status: mapZapStatus(json.status),
      signatories,
      signedPdfUrl: json.signed_file || undefined,
      signedPdfHash: json.signed_file_hash || undefined,
    }
  }

  async cancel(
    providerDocId: string,
    reason: string
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.isReady()) throw new Error('ZAPSIGN_API_KEY não configurada')

    const res = await fetch(`${this.baseUrl}/docs/${providerDocId}/cancel/`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ reason }),
    })
    if (!res.ok) {
      const json: any = await res.json().catch(() => ({}))
      return {
        ok: false,
        error: json?.message || `ZapSign cancel HTTP ${res.status}`,
      }
    }
    return { ok: true }
  }

  async downloadSignedPdf(providerDocId: string): Promise<Buffer> {
    if (!this.isReady()) throw new Error('ZAPSIGN_API_KEY não configurada')
    const st = await this.status(providerDocId)
    if (!st.signedPdfUrl) {
      throw new Error('PDF assinado ainda não disponível no ZapSign')
    }
    const res = await fetch(st.signedPdfUrl)
    if (!res.ok) {
      throw new Error(`ZapSign download HTTP ${res.status}`)
    }
    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  }
}

/**
 * HMAC-SHA256 do body do webhook (cabeçalho `X-Zapsign-Signature` ou similar).
 * ZapSign atualmente assina via secret configurado no painel.
 * Util compartilhado para validação no endpoint de webhook.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string | null
): boolean {
  if (!secret) return true // workspace sem secret configurado: aceita (não loop retry)
  if (!signature) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  try {
    const a = Buffer.from(signature, 'hex')
    const b = Buffer.from(expected, 'hex')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
