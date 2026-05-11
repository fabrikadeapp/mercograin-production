/**
 * AI Key Vault — criptografia AES-256-GCM para chaves OpenAI BYOK.
 *
 * Usa `AI_MASTER_KEY` (env var) como master key.
 *   - Deve ter 64 chars hex = 32 bytes
 *   - Gerar: `openssl rand -hex 32`
 *
 * Cada chave armazenada tem seu próprio IV (12 bytes) e auth tag (16 bytes).
 * Schema: Workspace.aiKeyEncrypted (base64), aiKeyIv (hex), aiKeyTag (hex).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'

function masterKey(): Buffer {
  const raw = process.env.AI_MASTER_KEY
  if (!raw) {
    throw new Error(
      'AI_MASTER_KEY não configurada. Gere com: openssl rand -hex 32',
    )
  }
  if (raw.length !== 64) {
    throw new Error('AI_MASTER_KEY deve ter 64 chars hex (32 bytes)')
  }
  return Buffer.from(raw, 'hex')
}

export interface EncryptedKey {
  encrypted: string // base64
  iv: string // hex
  tag: string // hex
}

export function encryptApiKey(plain: string): EncryptedKey {
  if (!plain || plain.length < 20) {
    throw new Error('Chave inválida')
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, masterKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    encrypted: enc.toString('base64'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  }
}

export function decryptApiKey(payload: EncryptedKey): string {
  const decipher = createDecipheriv(
    ALGO,
    masterKey(),
    Buffer.from(payload.iv, 'hex'),
  )
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'))
  const dec = Buffer.concat([
    decipher.update(Buffer.from(payload.encrypted, 'base64')),
    decipher.final(),
  ])
  return dec.toString('utf8')
}

/**
 * Retorna a chave em formato mascarado para exibição no UI.
 * Ex.: sk-proj-***...***-AbCd
 */
export function maskKey(key: string): string {
  if (!key) return ''
  if (key.length < 16) return '••••'
  return `${key.slice(0, 7)}…${key.slice(-4)}`
}

/**
 * Validação simples de formato OpenAI:
 *   - Começa com 'sk-' (project keys: 'sk-proj-')
 *   - Mínimo 40 chars
 */
export function isValidOpenAIKey(key: string): boolean {
  if (!key) return false
  if (!key.startsWith('sk-')) return false
  if (key.length < 40) return false
  return true
}
