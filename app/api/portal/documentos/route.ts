import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'
import { uploadFile, getSignedUrl } from '@/lib/supabase/storage'
import { logAudit } from '@/lib/audit/log'

const BUCKET = process.env.SUPABASE_DOCS_BUCKET || 'portal-docs'
const MAX_BYTES = 10 * 1024 * 1024 // 10MB

export async function GET() {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const docs = await db.documentoProdutor.findMany({
    where: { clienteId: scope.clienteId, workspaceId: scope.workspaceId, visivel: true },
    orderBy: { createdAt: 'desc' },
  })
  // gerar signed URLs sob demanda (1h)
  const withUrls = await Promise.all(
    docs.map(async (d) => {
      let signed: string | null = null
      try {
        signed = await getSignedUrl(BUCKET, d.arquivoUrl, 3600)
      } catch {
        signed = null
      }
      return { ...d, signedUrl: signed }
    })
  )
  return NextResponse.json({ documentos: withUrls })
}

export async function POST(req: NextRequest) {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await req.json()
    const { titulo, tipo = 'outro', descricao, fileBase64, mimeType, fileName } = body || {}
    if (!titulo || !fileBase64 || !mimeType || !fileName) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }
    const buf = Buffer.from(fileBase64, 'base64')
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Arquivo > 10MB' }, { status: 400 })
    }
    const hash = crypto.createHash('sha256').update(buf).digest('hex')
    const path = `${scope.workspaceId}/${scope.clienteId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    await uploadFile({ bucket: BUCKET, path, buffer: buf, contentType: mimeType })
    const doc = await db.documentoProdutor.create({
      data: {
        workspaceId: scope.workspaceId,
        clienteId: scope.clienteId,
        tipo,
        titulo,
        descricao,
        arquivoUrl: path,
        arquivoHash: hash,
        tamanhoBytes: buf.length,
        mimeType,
        enviadoPor: 'produtor',
        uploaderId: scope.accessId,
      },
    })
    await logAudit({
      userId: 'portal-produtor',
      workspaceId: scope.workspaceId,
      acao: 'create',
      entidade: 'DocumentoProdutor',
      entidadeId: doc.id,
    })
    return NextResponse.json({ documento: doc })
  } catch (e: any) {
    console.error('[portal/documentos POST]', e)
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const doc = await db.documentoProdutor.findFirst({
    where: { id, clienteId: scope.clienteId, enviadoPor: 'produtor' },
  })
  if (!doc) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  await db.documentoProdutor.update({ where: { id }, data: { visivel: false } })
  return NextResponse.json({ ok: true })
}
