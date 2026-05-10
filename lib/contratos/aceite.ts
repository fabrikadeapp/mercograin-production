/**
 * Aceite digital — token assinado HMAC-SHA256 que vai no link enviado ao produtor.
 *
 * Formato: base64url(contratoId).base64url(nonce).base64url(hmac)
 * - O DB armazena apenas SHA-256 do token, nunca o token cru.
 * - Validação usa timingSafeEqual contra forjamentos.
 * - Token sozinho NÃO confere acesso: precisa estar registrado no AceiteContrato
 *   correspondente E não estar expirado.
 */
import crypto from 'crypto'

const SECRET =
  process.env.ACEITE_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'fallback-dev-only-NOT-FOR-PRODUCTION'

function b64url(buf: Buffer | string): string {
  return Buffer.isBuffer(buf)
    ? buf.toString('base64url')
    : Buffer.from(buf).toString('base64url')
}

export function gerarTokenAceite(contratoId: string): {
  token: string
  tokenHash: string
} {
  const nonce = crypto.randomBytes(16).toString('base64url')
  const idEncoded = b64url(contratoId)
  const data = `${idEncoded}.${nonce}`
  const sig = crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('base64url')
  const token = `${data}.${sig}`
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return { token, tokenHash }
}

export function validarTokenAceite(token: string): {
  contratoId: string
  valid: boolean
} {
  if (!token || typeof token !== 'string') {
    return { contratoId: '', valid: false }
  }
  const parts = token.split('.')
  if (parts.length !== 3) return { contratoId: '', valid: false }
  const [idEncoded, nonce, sig] = parts
  const expectedSig = crypto
    .createHmac('sha256', SECRET)
    .update(`${idEncoded}.${nonce}`)
    .digest('base64url')

  let valid = false
  try {
    const sigBuf = Buffer.from(sig, 'base64url')
    const expBuf = Buffer.from(expectedSig, 'base64url')
    valid =
      sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)
  } catch {
    valid = false
  }

  let contratoId = ''
  try {
    contratoId = Buffer.from(idEncoded, 'base64url').toString('utf8')
  } catch {
    contratoId = ''
  }

  return { contratoId, valid }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
