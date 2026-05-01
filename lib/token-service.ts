/**
 * Token Service - Generate secure tokens for email verification and password reset
 */

import { randomBytes } from 'crypto'

/**
 * Generate a secure random token
 * Returns 32 bytes of random data as hex string
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Generate token expiry date (default: 1 hour from now)
 */
export function getTokenExpiry(hours: number = 1): Date {
  const now = new Date()
  now.setHours(now.getHours() + hours)
  return now
}

/**
 * Check if token is expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}

/**
 * Hash a token (for storage, using simple approach)
 * In production, consider using bcrypt or argon2
 */
export function hashToken(token: string): string {
  // Simple hash using Buffer (not cryptographically secure for passwords,
  // but acceptable for one-time tokens with short expiry)
  const hash = require('crypto').createHash('sha256')
  hash.update(token)
  return hash.digest('hex')
}

/**
 * Verify a token against its hash
 */
export function verifyTokenHash(token: string, hash: string): boolean {
  return hashToken(token) === hash
}
