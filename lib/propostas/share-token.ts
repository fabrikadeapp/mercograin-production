/**
 * Token HMAC-SHA256 público de Proposta. Permite gerar link de PDF
 * compartilhável sem login — caso de uso: WhatsApp / email para cliente
 * abrir e ler a proposta.
 *
 * Padrão clonado de lib/romaneios/token.ts e lib/contratos/aceite.ts.
 * Formato: base64url(propostaId).base64url(nonce).base64url(expEpoch).base64url(hmac)
 */

import crypto from 'crypto'

const SECRET =
  process.env.PROPOSTA_SHARE_SECRET ||
  process.env.ROMANEIO_SECRET ||
  process.env.ACEITE_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'fallback-dev-only-NOT-FOR-PRODUCTION'

const DEFAULT_TTL_DAYS = 30

function b64url(buf: Buffer | string): string {
  return Buffer.isBuffer(buf)
    ? buf.toString('base64url')
    : Buffer.from(buf).toString('base64url')
}

export interface TokenPropostaGerado {
  token: string
  tokenHash: string
  expiraEm: Date
}

/**
 * Gera token. Quando `expiraEm` é informada, usa ela; senão default = +30 dias.
 * Em propostas, a melhor prática é usar a `validadeEm` da própria proposta.
 */
export function gerarTokenProposta(
  propostaId: string,
  opts: { expiraEm?: Date; ttlDays?: number } = {}
): TokenPropostaGerado {
  const nonce = crypto.randomBytes(12).toString('base64url')
  const expiraEm =
    opts.expiraEm ?? new Date(Date.now() + (opts.ttlDays ?? DEFAULT_TTL_DAYS) * 86_400_000)
  const expEpoch = b64url(String(Math.floor(expiraEm.getTime() / 1000)))
  const idEncoded = b64url(propostaId)
  const data = `${idEncoded}.${nonce}.${expEpoch}`
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  const token = `${data}.${sig}`
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return { token, tokenHash, expiraEm }
}

export interface ValidacaoTokenProposta {
  propostaId: string
  valid: boolean
  expirado: boolean
  expiraEm: Date | null
}

export function validarTokenProposta(token: string): ValidacaoTokenProposta {
  const fail: ValidacaoTokenProposta = {
    propostaId: '',
    valid: false,
    expirado: false,
    expiraEm: null,
  }
  if (!token || typeof token !== 'string') return fail
  const parts = token.split('.')
  if (parts.length !== 4) return fail
  const [idEncoded, nonce, expEpoch, sig] = parts

  const expectedSig = crypto
    .createHmac('sha256', SECRET)
    .update(`${idEncoded}.${nonce}.${expEpoch}`)
    .digest('base64url')

  let assinaturaValida = false
  try {
    const sigBuf = Buffer.from(sig, 'base64url')
    const expBuf = Buffer.from(expectedSig, 'base64url')
    assinaturaValida =
      sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)
  } catch {
    assinaturaValida = false
  }
  if (!assinaturaValida) return fail

  let propostaId = ''
  try {
    propostaId = Buffer.from(idEncoded, 'base64url').toString('utf8')
  } catch {
    return fail
  }

  let expiraEm: Date | null = null
  try {
    const epoch = parseInt(Buffer.from(expEpoch, 'base64url').toString('utf8'), 10)
    if (!Number.isFinite(epoch)) return fail
    expiraEm = new Date(epoch * 1000)
  } catch {
    return fail
  }

  const expirado = expiraEm.getTime() < Date.now()
  return {
    propostaId,
    valid: !expirado,
    expirado,
    expiraEm,
  }
}

export function hashTokenProposta(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
