/**
 * Token HMAC-SHA256 para assinatura nativa.
 *
 * Formato: base64url(assinaturaId).base64url(signatorioIdx).base64url(nonce).base64url(expEpoch).base64url(hmac)
 *
 * Princípios (do docs/specs/assinaturapropriaonline.md):
 *   - Timing-safe compare
 *   - TTL embutido no token (30d default)
 *   - tokenHash (SHA-256) é persistido no DB; o token em si não
 *   - Nonce aleatório evita colisão entre signatários
 */

import crypto from 'crypto'

const SECRET =
  process.env.SIGNATURE_NATIVE_SECRET ||
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

export interface TokenGerado {
  token: string
  tokenHash: string
  expiraEm: Date
}

/**
 * Gera token para um signatário específico de uma assinatura.
 *   assinaturaId: AssinaturaDigital.id
 *   signatorioIdx: índice no array signatarios (0, 1, 2, ...)
 */
export function gerarTokenAssinatura(
  assinaturaId: string,
  signatorioIdx: number,
  opts: { ttlDays?: number; expiraEm?: Date } = {},
): TokenGerado {
  const nonce = crypto.randomBytes(12).toString('base64url')
  const expiraEm =
    opts.expiraEm ??
    new Date(Date.now() + (opts.ttlDays ?? DEFAULT_TTL_DAYS) * 86_400_000)
  const expEpoch = b64url(String(Math.floor(expiraEm.getTime() / 1000)))
  const idEncoded = b64url(assinaturaId)
  const idxEncoded = b64url(String(signatorioIdx))
  const data = `${idEncoded}.${idxEncoded}.${nonce}.${expEpoch}`
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  const token = `${data}.${sig}`
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return { token, tokenHash, expiraEm }
}

export interface ValidacaoToken {
  valid: boolean
  expirado: boolean
  assinaturaId: string
  signatorioIdx: number
  expiraEm: Date | null
  /** Hash do token recebido, para conferir com tokenHash do DB. */
  tokenHash: string
}

export function validarTokenAssinatura(token: string): ValidacaoToken {
  const fail: ValidacaoToken = {
    valid: false,
    expirado: false,
    assinaturaId: '',
    signatorioIdx: -1,
    expiraEm: null,
    tokenHash: '',
  }
  if (!token || typeof token !== 'string') return fail
  const parts = token.split('.')
  if (parts.length !== 5) return fail
  const [idEnc, idxEnc, nonce, expEpoch, sig] = parts

  const expectedSig = crypto
    .createHmac('sha256', SECRET)
    .update(`${idEnc}.${idxEnc}.${nonce}.${expEpoch}`)
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

  let assinaturaId = ''
  let signatorioIdx = -1
  let expiraEm: Date | null = null
  try {
    assinaturaId = Buffer.from(idEnc, 'base64url').toString('utf8')
    signatorioIdx = parseInt(Buffer.from(idxEnc, 'base64url').toString('utf8'), 10)
    const epoch = parseInt(Buffer.from(expEpoch, 'base64url').toString('utf8'), 10)
    if (!Number.isFinite(epoch) || !Number.isFinite(signatorioIdx)) return fail
    expiraEm = new Date(epoch * 1000)
  } catch {
    return fail
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expirado = expiraEm.getTime() < Date.now()
  return {
    valid: !expirado,
    expirado,
    assinaturaId,
    signatorioIdx,
    expiraEm,
    tokenHash,
  }
}

export function hashTokenAssinatura(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
