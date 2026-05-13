/**
 * BH Grain — Cofre genérico AES-256-GCM para segredos por workspace.
 *
 * Usado por:
 *  - Senha IMAP/SMTP (email)
 *  - Page Access Token Instagram
 *  - apiKey/instanceName/baseUrl Evolution
 *
 * Reaproveita AI_MASTER_KEY existente (32 bytes hex). Adiciona AAD com o
 * canal + workspaceId para que um payload de email NUNCA possa ser usado
 * como payload de WhatsApp (defense in depth).
 *
 * Formato armazenado: `${iv_hex}:${tag_hex}:${cipher_b64}`
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'

function masterKey(): Buffer {
  const raw = process.env.AI_MASTER_KEY
  if (!raw) {
    throw new Error('AI_MASTER_KEY não configurada. Gere com: openssl rand -hex 32')
  }
  if (raw.length !== 64) {
    throw new Error('AI_MASTER_KEY deve ter 64 chars hex (32 bytes)')
  }
  return Buffer.from(raw, 'hex')
}

export interface SecretContext {
  workspaceId: string
  channel: string // 'email' | 'instagram' | 'whatsapp'
  field: string // 'smtpPassword' | 'imapPassword' | 'pageAccessToken' | 'apiKey' | ...
}

function aad(ctx: SecretContext): Buffer {
  return Buffer.from(`${ctx.workspaceId}|${ctx.channel}|${ctx.field}`, 'utf8')
}

export function encryptSecret(plain: string, ctx: SecretContext): string {
  if (!plain) throw new Error('Segredo vazio')
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, masterKey(), iv)
  cipher.setAAD(aad(ctx))
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('base64')}`
}

export function decryptSecret(payload: string, ctx: SecretContext): string {
  const parts = payload.split(':')
  if (parts.length !== 3) throw new Error('Payload inválido')
  const [ivHex, tagHex, cipherB64] = parts
  const decipher = createDecipheriv(ALGO, masterKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAAD(aad(ctx))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const dec = Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ])
  return dec.toString('utf8')
}

/** Retorna prefixo + asteriscos para exibir em UI sem expor o segredo. */
export function maskSecret(plain: string, visibleChars = 3): string {
  if (!plain) return ''
  const visible = plain.slice(0, visibleChars)
  return `${visible}${'•'.repeat(Math.max(0, plain.length - visibleChars))}`
}
