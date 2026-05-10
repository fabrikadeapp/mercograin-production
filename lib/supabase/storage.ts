/**
 * Helpers para upload/delete de imagens no Supabase Storage.
 *
 * Bucket é público (default: phb-grain-uploads). Limite 2MB.
 * MIME types permitidos: PNG, JPEG/JPG, SVG, WebP.
 */
import { getSupabaseAdmin, SUPABASE_BUCKET } from './server'

export interface UploadResult {
  /** Path relativo dentro do bucket. Ex: 'logos/ws_xxx-1700000000.png' */
  path: string
  /** URL pública servível (já inclui /storage/v1/object/public/{bucket}/...) */
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

export async function uploadImage(opts: {
  buffer: Buffer
  mimeType: string
  /** Prefixo de pasta dentro do bucket. Ex: 'logos' */
  pathPrefix: string
  /** Nome do arquivo já com extensão. Chamador define unicidade. */
  fileName: string
}): Promise<UploadResult> {
  if (!ALLOWED_MIME.has(opts.mimeType)) {
    throw new Error(`MIME type não permitido: ${opts.mimeType}`)
  }
  if (opts.buffer.length > MAX_BYTES) {
    throw new Error(`Arquivo maior que 2MB (${opts.buffer.length} bytes)`)
  }

  const supabase = getSupabaseAdmin()
  const fullPath = `${opts.pathPrefix}/${opts.fileName}`

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(fullPath, opts.buffer, {
      contentType: opts.mimeType,
      cacheControl: '31536000',
      upsert: true,
    })
  if (error) throw new Error(`Supabase upload failed: ${error.message}`)

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(fullPath)

  return { path: fullPath, publicUrl: data.publicUrl }
}

/**
 * Remove imagem do bucket. Aceita tanto path relativo ('logos/foo.png')
 * quanto URL pública completa. Falhas são apenas logadas (best-effort).
 */
export async function deleteImage(path: string): Promise<void> {
  if (!path) return
  const supabase = getSupabaseAdmin()
  const marker = `/storage/v1/object/public/${SUPABASE_BUCKET}/`
  const normalized = path.includes(marker)
    ? path.split(marker)[1] ?? path
    : path
  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .remove([normalized])
  if (error) console.warn('[supabase] delete failed:', error.message)
}

/**
 * Upload genérico para qualquer bucket (público ou privado). Sem validação de
 * MIME type/tamanho — chamador é responsável. Usado por fluxos não-imagem
 * como backups Postgres.
 */
export async function uploadFile(opts: {
  bucket: string
  path: string
  buffer: Buffer
  contentType: string
}): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage
    .from(opts.bucket)
    .upload(opts.path, opts.buffer, {
      contentType: opts.contentType,
      upsert: true,
    })
  if (error) throw new Error(`Supabase upload failed: ${error.message}`)
  return opts.path
}

/**
 * Gera URL temporária assinada para arquivo em bucket privado.
 * @param expiresIn segundos até expirar (default 1h)
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)
  if (error || !data) {
    throw new Error(`Sign URL failed: ${error?.message ?? 'unknown error'}`)
  }
  return data.signedUrl
}

/** Lista arquivos em um bucket (até 100), ordenados por created_at desc. */
export async function listFiles(bucket: string, prefix?: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix || '', {
      sortBy: { column: 'created_at', order: 'desc' },
      limit: 100,
    })
  if (error) throw new Error(error.message)
  return data || []
}

/** Remove um ou mais arquivos. Best-effort (apenas loga warn em falha). */
export async function deleteFile(bucket: string, paths: string[]) {
  if (paths.length === 0) return
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(bucket).remove(paths)
  if (error) console.warn('[supabase] delete failed:', error.message)
}

/**
 * Detecta se uma URL aponta para nosso bucket Supabase.
 * Retorna false para data-URLs, paths locais (/uploads/...) ou URLs externas.
 */
export function isSupabaseUrl(url: string | null | undefined): boolean {
  if (!url) return false
  if (!url.includes('/storage/v1/object/public/')) return false
  const host = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '')
  return host ? url.includes(host) : url.includes('supabase.co')
}
