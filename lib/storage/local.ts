/**
 * Storage local em volume montado (Railway Volume).
 *
 * Substituto direto de lib/supabase/storage.ts. Mesma assinatura nas funções
 * uploadImage / uploadFile / deleteImage / deleteFile / getSignedUrl / listFiles
 * para minimizar mudança nos callers.
 *
 * Layout no disco:
 *   /data/uploads/<bucket>/<path>
 *
 * URLs públicas:
 *   /api/files/<bucket>/<path>  ← servido pela rota proxy
 *
 * Para arquivos privados (backups, certificados sensíveis) gerar URL
 * assinada com getSignedUrl() → /api/files/signed/<token>.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { createHmac, randomBytes } from 'crypto'

const ROOT = process.env.STORAGE_ROOT || '/data/uploads'
const PUBLIC_PREFIX = '/api/files'
const SIGN_SECRET =
  process.env.STORAGE_SIGN_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'dev-only-secret-do-not-use'

export interface UploadResult {
  /** Path relativo dentro do storage (sem bucket). Ex: 'logos/ws_xxx-1700000000.png' */
  path: string
  /** URL pública servível. Ex: '/api/files/phb-grain-uploads/logos/ws_xxx.png' */
  publicUrl: string
}

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
])

const MAX_BYTES = 2 * 1024 * 1024 // 2MB

export function getExtensionForMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/svg+xml':
      return 'svg'
    case 'image/webp':
      return 'webp'
    default:
      return 'bin'
  }
}

function safeJoin(...parts: string[]): string {
  const joined = path.join(...parts)
  const resolved = path.resolve(joined)
  if (!resolved.startsWith(path.resolve(ROOT))) {
    throw new Error('Path traversal bloqueado')
  }
  return resolved
}

async function ensureDir(p: string) {
  await fs.mkdir(path.dirname(p), { recursive: true })
}

const DEFAULT_BUCKET =
  process.env.SUPABASE_BUCKET_UPLOADS || 'phb-grain-uploads'

export async function uploadImage(opts: {
  buffer: Buffer
  mimeType: string
  pathPrefix: string
  fileName: string
}): Promise<UploadResult> {
  if (!ALLOWED_MIME.has(opts.mimeType)) {
    throw new Error(`MIME type não permitido: ${opts.mimeType}`)
  }
  if (opts.buffer.length > MAX_BYTES) {
    throw new Error(`Arquivo maior que 2MB (${opts.buffer.length} bytes)`)
  }
  const relPath = `${opts.pathPrefix}/${opts.fileName}`
  const fullPath = safeJoin(ROOT, DEFAULT_BUCKET, relPath)
  await ensureDir(fullPath)
  await fs.writeFile(fullPath, opts.buffer)
  return {
    path: relPath,
    publicUrl: `${PUBLIC_PREFIX}/${DEFAULT_BUCKET}/${relPath}`,
  }
}

export async function deleteImage(input: string): Promise<void> {
  if (!input) return
  // Aceita URL pública /api/files/<bucket>/<path> ou path relativo
  const marker = `${PUBLIC_PREFIX}/${DEFAULT_BUCKET}/`
  const rel = input.includes(marker) ? input.split(marker)[1] ?? input : input
  try {
    const fullPath = safeJoin(ROOT, DEFAULT_BUCKET, rel)
    await fs.unlink(fullPath)
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.warn('[storage] delete failed:', err?.message)
    }
  }
}

export async function uploadFile(opts: {
  bucket: string
  path: string
  buffer: Buffer
  contentType: string
}): Promise<string> {
  const fullPath = safeJoin(ROOT, opts.bucket, opts.path)
  await ensureDir(fullPath)
  await fs.writeFile(fullPath, opts.buffer)
  return opts.path
}

/**
 * Gera URL assinada para arquivo em "bucket privado".
 * Como tudo é servido pelo Next, a privacidade vem do token HMAC com TTL.
 *
 * Formato: /api/files/signed/<bucket>/<path>?exp=<unix>&sig=<hmac>
 */
export async function getSignedUrl(
  bucket: string,
  filePath: string,
  expiresIn = 3600,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresIn
  const message = `${bucket}/${filePath}|${exp}`
  const sig = createHmac('sha256', SIGN_SECRET).update(message).digest('hex')
  return `${PUBLIC_PREFIX}/signed/${bucket}/${filePath}?exp=${exp}&sig=${sig}`
}

export function verifySignedUrl(
  bucket: string,
  filePath: string,
  exp: number,
  sig: string,
): boolean {
  if (!exp || !sig) return false
  if (Date.now() / 1000 > exp) return false
  const expected = createHmac('sha256', SIGN_SECRET)
    .update(`${bucket}/${filePath}|${exp}`)
    .digest('hex')
  // Comparação constant-time
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  }
  return diff === 0
}

export async function listFiles(
  bucket: string,
  prefix?: string,
): Promise<Array<{ name: string; size: number; createdAt: Date }>> {
  const dir = safeJoin(ROOT, bucket, prefix || '')
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const result: Array<{ name: string; size: number; createdAt: Date }> = []
    for (const e of entries) {
      if (e.isFile()) {
        const stat = await fs.stat(path.join(dir, e.name))
        result.push({
          name: e.name,
          size: stat.size,
          createdAt: stat.birthtime,
        })
      }
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  } catch (err: any) {
    if (err?.code === 'ENOENT') return []
    throw err
  }
}

export async function deleteFile(bucket: string, paths: string[]) {
  if (paths.length === 0) return
  for (const p of paths) {
    try {
      const fullPath = safeJoin(ROOT, bucket, p)
      await fs.unlink(fullPath)
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        console.warn(`[storage] delete failed (${p}):`, err?.message)
      }
    }
  }
}

export async function readFile(
  bucket: string,
  filePath: string,
): Promise<Buffer> {
  const fullPath = safeJoin(ROOT, bucket, filePath)
  return fs.readFile(fullPath)
}

/** Detecta se uma URL aponta para nosso storage local. */
export function isLocalStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return url.startsWith(PUBLIC_PREFIX + '/')
}

// Alias pra compatibilidade enquanto migramos os callers
export const isSupabaseUrl = isLocalStorageUrl
