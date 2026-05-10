/**
 * TOTP (RFC 6238) — compatível com Google Authenticator, Authy, MS Authenticator.
 *
 * Lib `otpauth` (npm, gratuita). Não armazenamos o secret cifrado pra simplificar:
 * o controle de acesso ao DB já é a barreira primária. Em produção crítica,
 * recomenda-se cifrar `User.totpSecret` at-rest com KMS.
 */
import * as OTPAuth from 'otpauth'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const ISSUER = 'BH Grain'

export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 })
  return secret.base32
}

export function buildTotpUri(email: string, base32: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32),
  })
  return totp.toString()
}

export function verifyTotp(base32: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32),
  })
  // window=1 → aceita o atual + 30s antes/depois (60s tolerância clock-skew)
  const delta = totp.validate({ token, window: 1 })
  return delta !== null
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    crypto
      .randomBytes(5)
      .toString('hex')
      .toUpperCase()
      .match(/.{4}/g)!
      .join('-')
  )
}

export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(c, 8)))
}

export async function consumeRecoveryCode(
  hashedCodes: string[],
  input: string
): Promise<{ ok: boolean; remaining: string[] }> {
  const normalized = input.trim().toUpperCase()
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(normalized, hashedCodes[i])) {
      const remaining = hashedCodes.filter((_, idx) => idx !== i)
      return { ok: true, remaining }
    }
  }
  return { ok: false, remaining: hashedCodes }
}
