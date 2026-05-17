import { NextRequest, NextResponse } from 'next/server'
import { readFile, verifySignedUrl } from '@/lib/storage/local'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  csv: 'text/csv',
  txt: 'text/plain',
  json: 'application/json',
  xml: 'application/xml',
  zip: 'application/zip',
  sql: 'application/sql',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function detectMime(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

/**
 * GET /api/files/<bucket>/<path...>
 * GET /api/files/signed/<bucket>/<path...>?exp=...&sig=...
 *
 * Servidor de arquivos do Railway Volume. Substitui /storage/v1/object/public/...
 * do Supabase.
 *
 * - Path normal: serve público com cache forte
 * - Path /signed/: verifica HMAC + expiração antes de servir
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const parts = params.path ?? []
  if (parts.length < 2) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 })
  }

  const isSigned = parts[0] === 'signed'
  const segments = isSigned ? parts.slice(1) : parts

  if (segments.length < 2) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 })
  }

  const bucket = segments[0]
  const filePath = segments.slice(1).join('/')

  if (isSigned) {
    const exp = Number(req.nextUrl.searchParams.get('exp') ?? 0)
    const sig = req.nextUrl.searchParams.get('sig') ?? ''
    if (!verifySignedUrl(bucket, filePath, exp, sig)) {
      return NextResponse.json({ error: 'signature_invalid_or_expired' }, { status: 403 })
    }
  }

  let buffer: Buffer
  try {
    buffer = await readFile(bucket, filePath)
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    console.error('[files] read error:', err)
    return NextResponse.json({ error: 'read_failed' }, { status: 500 })
  }

  const contentType = detectMime(filePath)

  // Cache forte para públicos; sem cache para signed (TTL curto, dado privado).
  const cacheControl = isSigned
    ? 'private, no-cache, no-store, must-revalidate'
    : 'public, max-age=86400, s-maxage=2592000, immutable'

  const ab = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer

  return new NextResponse(ab, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': cacheControl,
    },
  })
}
