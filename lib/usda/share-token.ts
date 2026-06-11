/**
 * Token HMAC-SHA256 público de Relatório USDA. Permite gerar um link
 * compartilhável (WhatsApp / email) para abrir o relatório sem login.
 *
 * Padrão clonado de lib/propostas/share-token.ts.
 * Formato: base64url(relatorioId).base64url(nonce).base64url(expEpoch).base64url(hmac)
 */

import crypto from 'crypto'

const SECRET =
  process.env.RELATORIO_USDA_SHARE_SECRET ||
  process.env.PROPOSTA_SHARE_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'fallback-dev-only-NOT-FOR-PRODUCTION'

const DEFAULT_TTL_DAYS = 90

function b64url(buf: Buffer | string): string {
  return Buffer.isBuffer(buf)
    ? buf.toString('base64url')
    : Buffer.from(buf).toString('base64url')
}

export interface TokenRelatorioGerado {
  token: string
  tokenHash: string
  expiraEm: Date
}

/**
 * Gera token para um relatório. Quando `expiraEm` é informada, usa ela;
 * senão default = +90 dias (ou `ttlDays`).
 */
export function gerarTokenRelatorio(
  relatorioId: string,
  opts: { expiraEm?: Date; ttlDays?: number } = {},
): TokenRelatorioGerado {
  const nonce = crypto.randomBytes(12).toString('base64url')
  const expiraEm =
    opts.expiraEm ?? new Date(Date.now() + (opts.ttlDays ?? DEFAULT_TTL_DAYS) * 86_400_000)
  const expEpoch = b64url(String(Math.floor(expiraEm.getTime() / 1000)))
  const idEncoded = b64url(relatorioId)
  const data = `${idEncoded}.${nonce}.${expEpoch}`
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  const token = `${data}.${sig}`
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return { token, tokenHash, expiraEm }
}

export interface ValidacaoTokenRelatorio {
  relatorioId: string
  valid: boolean
  expirado: boolean
  expiraEm: Date | null
}

export function validarTokenRelatorio(token: string): ValidacaoTokenRelatorio {
  const fail: ValidacaoTokenRelatorio = {
    relatorioId: '',
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

  let relatorioId = ''
  try {
    relatorioId = Buffer.from(idEncoded, 'base64url').toString('utf8')
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
    relatorioId,
    valid: !expirado,
    expirado,
    expiraEm,
  }
}

export function hashTokenRelatorio(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
