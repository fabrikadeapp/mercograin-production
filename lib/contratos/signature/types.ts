/**
 * Abstração de provider de assinatura digital.
 * Permite trocar Mock ↔ ZapSign ↔ ClickSign ↔ D4Sign sem mudar regra de negócio.
 *
 * Default: MockProvider (sem rede). Provider real só é selecionado via
 * ConfiguracaoFiscal.providerNome (reaproveitado) ou env, e só é instanciado
 * quando a API key correspondente estiver configurada.
 */

export type AuthMode = 'simple' | 'icp_brasil' | 'sms' | 'email_token'

export type SignatureStatusValue =
  | 'pendente'
  | 'parcial'
  | 'assinado'
  | 'recusado'
  | 'expirado'
  | 'cancelado'

export interface Signatario {
  name: string
  cpfCnpj: string
  email?: string
  phone?: string
  authMode: AuthMode
}

export interface SignaturePayload {
  contractId: string
  contractNumber: string
  pdfBuffer: Buffer
  pdfFileName: string
  pdfHash: string
  signatories: Signatario[]
  externalId?: string
  webhookUrl?: string
}

export interface SignatureResponse {
  ok: boolean
  /** ID do documento no provider (ex: ZapSign token) */
  providerDocId: string
  signUrls: Array<{ signatoryEmail: string; url: string }>
  status: SignatureStatusValue
  rawResponse?: any
  error?: string
}

export interface SignatureStatus {
  providerDocId: string
  status: SignatureStatusValue
  signatories: Array<{
    cpfCnpj: string
    name: string
    signedAt: Date | null
    refusedAt: Date | null
    authMode: AuthMode
    ip?: string
  }>
  /** URL temporária do PDF assinado */
  signedPdfUrl?: string
  signedPdfHash?: string
}

export interface SignatureProvider {
  name: string
  isReady(): boolean
  send(payload: SignaturePayload): Promise<SignatureResponse>
  status(providerDocId: string): Promise<SignatureStatus>
  cancel(
    providerDocId: string,
    reason: string
  ): Promise<{ ok: boolean; error?: string }>
  downloadSignedPdf(providerDocId: string): Promise<Buffer>
}
