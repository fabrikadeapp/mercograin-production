/**
 * Provider MOCK — simula fluxo completo sem chamar API externa.
 * Útil para dev/staging/demo.
 *
 * Comportamento:
 *  - send(): aceita qualquer payload, gera providerDocId aleatório, retorna
 *    signUrls fictícias por signatário, status='pendente'.
 *  - status(): se nunca finalizado, devolve 'pendente' por default;
 *    útil em testes que façam progress manual via mockMarkSigned().
 *  - cancel(): sempre OK.
 *  - downloadSignedPdf(): retorna buffer placeholder.
 */
import crypto from 'crypto'
import type {
  SignatureProvider,
  SignaturePayload,
  SignatureResponse,
  SignatureStatus,
} from './types'

const memory = new Map<
  string,
  {
    payload: SignaturePayload
    state: SignatureStatus
  }
>()

function fakeUrl(docId: string, email: string): string {
  return `https://mock.signature.local/sign/${docId}?email=${encodeURIComponent(
    email
  )}`
}

export class MockSignatureProvider implements SignatureProvider {
  name = 'mock'

  isReady(): boolean {
    return true
  }

  async send(payload: SignaturePayload): Promise<SignatureResponse> {
    const providerDocId = `mock_${crypto.randomBytes(8).toString('hex')}`
    const signUrls = payload.signatories.map((s) => ({
      signatoryEmail: s.email || s.cpfCnpj,
      url: fakeUrl(providerDocId, s.email || s.cpfCnpj),
    }))

    const state: SignatureStatus = {
      providerDocId,
      status: 'pendente',
      signatories: payload.signatories.map((s) => ({
        cpfCnpj: s.cpfCnpj,
        name: s.name,
        signedAt: null,
        refusedAt: null,
        authMode: s.authMode,
      })),
    }

    memory.set(providerDocId, { payload, state })

    return {
      ok: true,
      providerDocId,
      signUrls,
      status: 'pendente',
      rawResponse: { mock: true, count: payload.signatories.length },
    }
  }

  async status(providerDocId: string): Promise<SignatureStatus> {
    const entry = memory.get(providerDocId)
    if (!entry) {
      return {
        providerDocId,
        status: 'pendente',
        signatories: [],
      }
    }
    return entry.state
  }

  async cancel(
    providerDocId: string,
    reason: string
  ): Promise<{ ok: boolean; error?: string }> {
    if (!reason || reason.length < 3) {
      return { ok: false, error: 'Motivo do cancelamento muito curto' }
    }
    const entry = memory.get(providerDocId)
    if (entry) {
      entry.state.status = 'cancelado'
    }
    return { ok: true }
  }

  async downloadSignedPdf(providerDocId: string): Promise<Buffer> {
    const entry = memory.get(providerDocId)
    if (!entry) return Buffer.from('mock-signed-pdf-empty')
    return Buffer.concat([
      Buffer.from('MOCK-SIGNED-PDF\n'),
      entry.payload.pdfBuffer,
    ])
  }

  // ============ Helpers usados em testes ============
  /** @internal — usado apenas em testes para simular progresso. */
  static __markSigned(providerDocId: string): void {
    const entry = memory.get(providerDocId)
    if (!entry) return
    entry.state.signatories = entry.state.signatories.map((s) => ({
      ...s,
      signedAt: new Date(),
    }))
    entry.state.status = 'assinado'
    entry.state.signedPdfUrl = `mock://signed/${providerDocId}.pdf`
    entry.state.signedPdfHash = crypto
      .createHash('sha256')
      .update(`signed:${providerDocId}`)
      .digest('hex')
  }

  /** @internal — limpa memória entre testes. */
  static __reset(): void {
    memory.clear()
  }
}
