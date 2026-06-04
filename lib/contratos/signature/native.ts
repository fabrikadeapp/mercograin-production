/**
 * Provider nativo de assinatura — não depende de Zapsign/Clicksign.
 *
 * Implementa coleta de assinatura via página própria (/assinar/[token]).
 * Spec completa em docs/specs/assinaturapropriaonline.md.
 *
 * O provider:
 *   - Gera tokens HMAC por signatário (lib native-token)
 *   - Salva referência no DB via providerDocId = 'native:<assinaturaId>'
 *   - Retorna URLs apontando para a página pública /assinar/[token]
 *   - Notificação para signatário é disparada PELO CALLER do provider
 *     (endpoint enviar-assinatura), não pelo provider — assim mantém
 *     paridade com Zapsign/Clicksign que também são chamados externamente.
 *
 * Status/Cancel/Download usam tabela AssinaturaDigital diretamente.
 */

import crypto from 'crypto'
import { db } from '@/lib/db'
import type {
  SignatureProvider,
  SignaturePayload,
  SignatureResponse,
  SignatureStatus,
  SignatureStatusValue,
} from './types'
import { gerarTokenAssinatura } from './native-token'

interface NativeOpts {
  /** Origin/host para montar URL absoluta do link. */
  baseUrl?: string
}

export class NativeSignatureProvider implements SignatureProvider {
  name = 'native'

  constructor(private opts: NativeOpts = {}) {}

  isReady(): boolean {
    // Sempre pronto — sem dependência externa.
    return true
  }

  /**
   * Cria registro AssinaturaDigital e gera tokens.
   * Retorna URLs públicas /assinar/[token].
   *
   * NOTA: o caller (endpoint enviar-assinatura) é responsável por
   * salvar o pdfBuffer em storage e popular pdfOriginalHash quando
   * necessário. Aqui só gerenciamos tokens.
   */
  async send(payload: SignaturePayload): Promise<SignatureResponse> {
    const providerDocId = `native:${crypto.randomBytes(8).toString('hex')}`
    const base = this.opts.baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

    // Gera token por signatário. assinaturaId aqui é o providerDocId
    // (será cruzado depois com AssinaturaDigital.id na persistência).
    const signUrls: Array<{ signatoryEmail: string; url: string }> = []
    const tokensInternos: Array<{
      tokenHash: string
      expiraEm: Date
    }> = []

    for (let i = 0; i < payload.signatories.length; i++) {
      const s = payload.signatories[i]
      const { token, tokenHash, expiraEm } = gerarTokenAssinatura(
        providerDocId,
        i,
        { ttlDays: 30 },
      )
      const url = `${base}/assinar/${token}`
      signUrls.push({ signatoryEmail: s.email ?? s.cpfCnpj, url })
      tokensInternos.push({ tokenHash, expiraEm })
    }

    return {
      ok: true,
      providerDocId,
      signUrls,
      status: 'pendente',
      rawResponse: {
        provider: 'native',
        tokens: tokensInternos.map((t) => ({ tokenHash: t.tokenHash })),
      },
    }
  }

  /**
   * Consulta status via AssinaturaDigital persistida.
   * providerDocId aqui é a coluna AssinaturaDigital.providerDocId.
   */
  async status(providerDocId: string): Promise<SignatureStatus> {
    const a = await db.assinaturaDigital.findUnique({
      where: { providerDocId },
    })
    if (!a) {
      return {
        providerDocId,
        status: 'pendente',
        signatories: [],
      }
    }
    const signatariosArr = Array.isArray(a.signatarios)
      ? (a.signatarios as Array<Record<string, unknown>>)
      : []

    return {
      providerDocId,
      status: a.status as SignatureStatusValue,
      signatories: signatariosArr.map((s) => ({
        cpfCnpj: String(s.cpfCnpj ?? ''),
        name: String(s.nome ?? s.name ?? ''),
        signedAt: s.signedAt ? new Date(String(s.signedAt)) : null,
        refusedAt: s.refusedAt ? new Date(String(s.refusedAt)) : null,
        authMode: (s.authMode as 'simple') ?? 'simple',
        ip: typeof s.ip === 'string' ? s.ip : undefined,
      })),
      signedPdfUrl: a.pdfAssinadoUrl ?? undefined,
      signedPdfHash: a.pdfAssinadoHash ?? undefined,
    }
  }

  /**
   * Cancela coleta de assinatura. Só funciona se nenhum signatário
   * ainda assinou.
   */
  async cancel(
    providerDocId: string,
    reason: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const a = await db.assinaturaDigital.findUnique({
      where: { providerDocId },
      select: { id: true, status: true, signatarios: true },
    })
    if (!a) return { ok: false, error: 'nao_encontrada' }
    if (a.status === 'assinado') {
      return { ok: false, error: 'ja_assinado' }
    }
    if (a.status === 'cancelado') {
      return { ok: true } // idempotente
    }

    await db.assinaturaDigital.update({
      where: { id: a.id },
      data: {
        status: 'cancelado',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({
          canceladoEm: new Date(),
          canceladoMotivo: reason.slice(0, 500),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
      },
    })
    return { ok: true }
  }

  /**
   * Retorna PDF final assinado se já existe.
   * Caso ainda não finalizado, retorna buffer vazio (caller deve
   * checar status antes).
   */
  async downloadSignedPdf(providerDocId: string): Promise<Buffer> {
    const a = await db.assinaturaDigital.findUnique({
      where: { providerDocId },
      select: { pdfAssinadoUrl: true, status: true },
    })
    if (!a || a.status !== 'assinado' || !a.pdfAssinadoUrl) {
      return Buffer.alloc(0)
    }
    // Se URL aponta para um arquivo local salvo via storage, lê.
    // Para v1 retornamos vazio — implementar leitura quando integrar
    // download via UI.
    return Buffer.alloc(0)
  }
}
