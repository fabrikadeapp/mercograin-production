/**
 * Geração de códigos de licença e tokens de onboarding.
 *
 * Formato do código: BHG-YYYY-XXXXXX
 *  - YYYY: ano corrente
 *  - XXXXXX: 6 caracteres alfanuméricos uppercase (sem 0/O/1/I para evitar confusão)
 *
 * Token de onboarding: 64 chars hex (randomBytes(32)) — usado na URL /ativar/{token}.
 */
import { randomBytes } from 'crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O/1/I

export function gerarCodigoLicenca(ano: number = new Date().getFullYear()): string {
  const bytes = randomBytes(6)
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return `BHG-${ano}-${suffix}`
}

export function gerarOnboardingToken(): string {
  return randomBytes(32).toString('hex')
}

export function onboardingExpiresIn(days: number = 7): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}
