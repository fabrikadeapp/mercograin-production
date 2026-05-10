/**
 * Token HMAC-SHA256 público de Romaneio (similar a aceite de contrato).
 *
 * Formato: base64url(romaneioId).base64url(nonce).base64url(expEpoch).base64url(hmac)
 * - DB armazena SHA-256 do token + dataExpiracao.
 * - Validação timing-safe + checa expiração.
 *
 * Caso de uso: conferente da portaria escaneia QR e abre página pública
 * /romaneios-publico/[token] sem precisar fazer login.
 */

import crypto from 'crypto'

const SECRET =
  process.env.ROMANEIO_SECRET ||
  process.env.ACEITE_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'fallback-dev-only-NOT-FOR-PRODUCTION'

const DEFAULT_TTL_DAYS = 7

function b64url(buf: Buffer | string): string {
  return Buffer.isBuffer(buf)
    ? buf.toString('base64url')
    : Buffer.from(buf).toString('base64url')
}

export function gerarTokenRomaneio(
  romaneioId: string,
  ttlDays: number = DEFAULT_TTL_DAYS
): { token: string; tokenHash: string; expiraEm: Date } {
  const nonce = crypto.randomBytes(12).toString('base64url')
  const expiraEm = new Date(Date.now() + ttlDays * 86_400_000)
  const expEpoch = b64url(String(Math.floor(expiraEm.getTime() / 1000)))
  const idEncoded = b64url(romaneioId)
  const data = `${idEncoded}.${nonce}.${expEpoch}`
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  const token = `${data}.${sig}`
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return { token, tokenHash, expiraEm }
}

export interface ValidacaoTokenRomaneio {
  romaneioId: string
  valid: boolean
  expirado: boolean
  expiraEm: Date | null
}

export function validarTokenRomaneio(token: string): ValidacaoTokenRomaneio {
  const fail: ValidacaoTokenRomaneio = {
    romaneioId: '',
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

  let romaneioId = ''
  try {
    romaneioId = Buffer.from(idEncoded, 'base64url').toString('utf8')
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
    romaneioId,
    valid: !expirado,
    expirado,
    expiraEm,
  }
}

export function hashTokenRomaneio(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
