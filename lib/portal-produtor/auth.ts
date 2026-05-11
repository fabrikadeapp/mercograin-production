/**
 * S12 M10 — Auth do portal produtor (separada do NextAuth da corretora).
 *
 * Modelo: cookie HttpOnly JWT assinado (bh_portal_session), exp 7d.
 * Senhas: bcrypt (rounds 12). Token inicial: 1-time, hash bcrypt, consumido no setup.
 */
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const COOKIE_NAME = 'bh_portal_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 dias
const BCRYPT_ROUNDS = 12

function secret(): string {
  return (
    process.env.PORTAL_PRODUTOR_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'dev-portal-produtor-secret-change-me'
  )
}

// --------- JWT minimal (HS256) sem dependência externa ---------

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}
function b64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64')
}

export interface PortalSession {
  workspaceId: string
  clienteId: string
  accessId: string
  iat: number
  exp: number
}

export function signSession(payload: Omit<PortalSession, 'iat' | 'exp'>): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body: PortalSession = { ...payload, iat: now, exp: now + COOKIE_MAX_AGE }
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(body))
  const sig = b64url(
    crypto.createHmac('sha256', secret()).update(`${h}.${p}`).digest()
  )
  return `${h}.${p}.${sig}`
}

export function verifySession(token: string): PortalSession | null {
  try {
    const [h, p, s] = token.split('.')
    if (!h || !p || !s) return null
    const expected = b64url(
      crypto.createHmac('sha256', secret()).update(`${h}.${p}`).digest()
    )
    // timing-safe compare
    const a = Buffer.from(s)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const payload = JSON.parse(b64urlDecode(p).toString('utf8')) as PortalSession
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// --------- Password / token helpers ---------

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false
  return bcrypt.compare(plain, hash)
}

/** Gera token raw (32 bytes hex) + hash bcrypt pra persistir. */
export async function generateInitialToken(): Promise<{ raw: string; hash: string }> {
  const raw = crypto.randomBytes(24).toString('hex')
  const hash = await bcrypt.hash(raw, BCRYPT_ROUNDS)
  return { raw, hash }
}
export async function verifyInitialToken(raw: string, hash: string): Promise<boolean> {
  if (!hash) return false
  return bcrypt.compare(raw, hash)
}

// --------- Cookie helpers ---------

export async function setSessionCookie(res: NextResponse, session: Omit<PortalSession, 'iat' | 'exp'>) {
  const token = signSession(session)
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}

export async function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 })
}

/** Lê e valida sessão do cookie em route handlers / server components. */
export async function getPortalSession(): Promise<PortalSession | null> {
  try {
    const c = await cookies()
    const tok = c.get(COOKIE_NAME)?.value
    if (!tok) return null
    return verifySession(tok)
  } catch {
    return null
  }
}
