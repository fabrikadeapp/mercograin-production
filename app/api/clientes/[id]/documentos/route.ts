import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { uploadFile, getSignedUrl } from '@/lib/supabase/storage'
import { logAudit } from '@/lib/audit/log'

const BUCKET = process.env.SUPABASE_DOCS_BUCKET || 'portal-docs'
const MAX_BYTES = 10 * 1024 * 1024

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const cliente = await db.cliente.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  const docs = await db.documentoProdutor.findMany({
    where: { clienteId: cliente.id },
    orderBy: { createdAt: 'desc' },
  })
  const withUrls = await Promise.all(
    docs.map(async (d) => {
      let signed: string | null = null
      try { signed = await getSignedUrl(BUCKET, d.arquivoUrl, 3600) } catch {}
      return { ...d, signedUrl: signed }
    })
  )
  return NextResponse.json({ documentos: withUrls })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const cliente = await db.cliente.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  try {
    const body = await req.json()
    const { titulo, tipo = 'outro', descricao, fileBase64, mimeType, fileName } = body || {}
    if (!titulo || !fileBase64 || !mimeType || !fileName) {
      return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 })
    }
    const buf = Buffer.from(fileBase64, 'base64')
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Arquivo > 10MB' }, { status: 400 })
    }
    const hash = crypto.createHash('sha256').update(buf).digest('hex')
    const path = `${cliente.workspaceId}/${cliente.id}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    await uploadFile({ bucket: BUCKET, path, buffer: buf, contentType: mimeType })
    const doc = await db.documentoProdutor.create({
      data: {
        workspaceId: cliente.workspaceId,
        clienteId: cliente.id,
        tipo, titulo, descricao,
        arquivoUrl: path, arquivoHash: hash,
        tamanhoBytes: buf.length, mimeType,
        enviadoPor: 'corretora', uploaderId: scope.userId,
      },
    })
    await logAudit({
      userId: scope.userId,
      workspaceId: cliente.workspaceId,
      acao: 'create',
      entidade: 'DocumentoProdutor',
      entidadeId: doc.id,
    })
    return NextResponse.json({ documento: doc })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro' }, { status: 500 })
  }
}
