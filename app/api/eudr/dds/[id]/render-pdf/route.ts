/**
 * S5 M9 — POST /api/eudr/dds/[id]/render-pdf
 *
 * Gera PDF do DDS, calcula SHA-256, faz upload no Supabase Storage
 * (bucket `eudr-dds`, path `{workspaceId}/{ddsId}.pdf`) e persiste pdfUrl/pdfHash.
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { renderDDSPdf } from '@/lib/eudr/dds-pdf'
import { uploadFile, getSignedUrl } from '@/lib/supabase/storage'
import { logAudit } from '@/lib/audit/log'

const BUCKET = process.env.SUPABASE_BUCKET_EUDR || 'eudr-dds'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const dds = await db.dueDiligenceStatement.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: { contrato: { select: { numero: true } } },
  })
  if (!dds) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const propriedades = Array.isArray(dds.propriedadesOrigem) ? (dds.propriedadesOrigem as any[]) : []
  const lotes = Array.isArray(dds.lotesEnvolvidos) ? (dds.lotesEnvolvidos as any[]) : []
  const fatores = Array.isArray(dds.riscoFatores) ? (dds.riscoFatores as any[]) : []

  const buffer = await renderDDSPdf({
    numero: dds.numero,
    emitidoEm: dds.atestadoEm || dds.createdAt,
    operador: {
      nome: dds.operadorNome,
      cnpj: dds.operadorCnpj,
      endereco: dds.operadorEndereco,
    },
    produto: {
      cultura: dds.cultura,
      ncm: dds.ncm,
      qtdToneladas: dds.qtdToneladas,
    },
    propriedades: propriedades.map((p: any) => ({
      nome: p.nome,
      car: p.car,
      carStatus: p.carStatus,
      areaHa: p.areaHa,
      municipio: p.municipio,
      uf: p.uf,
      centroideLat: p.centroideLat,
      centroideLng: p.centroideLng,
      embargoIbama: p.embargoIbama,
      sobreposicaoTI: p.sobreposicaoTI,
      sobreposicaoUC: p.sobreposicaoUC,
    })),
    lotes: lotes.map((l: any) => ({
      numero: l.numero,
      qtdSc: l.qtdSc,
      talhoesOrigem: l.talhoesOrigem,
    })),
    risco: {
      nivel: dds.riscoNivel as any,
      fatores: fatores.map((f: any) => ({ descricao: f.descricao, gravidade: f.gravidade })),
    },
    contratoNumero: dds.contrato?.numero,
    observacoes: dds.observacoes,
    hash: undefined, // calculado depois
  })

  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  const path = `${scope.workspaceId}/${dds.id}.pdf`

  let pdfUrl: string
  try {
    await uploadFile({
      bucket: BUCKET,
      path,
      buffer,
      contentType: 'application/pdf',
    })
    pdfUrl = await getSignedUrl(BUCKET, path, 60 * 60 * 24 * 7) // 7 dias
  } catch (err) {
    console.error('[DDS] upload Supabase falhou:', err)
    return NextResponse.json(
      { error: 'Falha ao salvar PDF', detail: (err as Error).message },
      { status: 500 },
    )
  }

  const updated = await db.dueDiligenceStatement.update({
    where: { id: dds.id },
    data: { pdfUrl, pdfHash: hash },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'create',
    entidade: 'dds_pdf',
    entidadeId: dds.id,
    mudancas: { hash, bytes: buffer.length },
  })

  return NextResponse.json({ pdfUrl: updated.pdfUrl, pdfHash: updated.pdfHash })
}
