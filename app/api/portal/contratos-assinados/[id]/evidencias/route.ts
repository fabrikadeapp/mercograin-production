/**
 * GET /api/portal/contratos-assinados/[id]/evidencias
 * Página de evidências da assinatura — acessível ao cliente logado.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'
import {
  renderEvidenciaPdf,
  type SignatarioEvidencia,
} from '@/lib/contratos/signature/evidence-pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface SignatarioStored {
  nome?: string
  name?: string
  email?: string
  cpfCnpj?: string
  telefone?: string
  phone?: string
  signedAt?: string | null
  refusedAt?: string | null
  ip?: string | null
  ua?: string | null
  acceptLanguage?: string | null
  authMode?: string
  geo?: { lat: number; lng: number } | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const contrato = await db.contrato.findFirst({
    where: {
      id: params.id,
      clienteId: scope.clienteId,
      workspaceId: scope.workspaceId,
    },
    include: {
      cliente: { select: { nome: true } },
      assinaturaDigital: true,
    },
  })
  if (!contrato) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const a = contrato.assinaturaDigital
  if (!a) {
    return NextResponse.json(
      { error: 'sem_coleta_de_assinatura' },
      { status: 404 },
    )
  }

  const empresa = await db.dadosEmpresa.findFirst({
    where: { workspaceId: scope.workspaceId },
    select: { razaoSocial: true, nomeFantasia: true },
  })

  const sigs: SignatarioStored[] = Array.isArray(a.signatarios)
    ? (a.signatarios as SignatarioStored[])
    : []
  const signatariosEvid: SignatarioEvidencia[] = sigs.map((s) => ({
    nome: s.nome ?? s.name,
    email: s.email,
    cpfCnpj: s.cpfCnpj,
    telefone: s.telefone ?? s.phone,
    signedAt: s.signedAt ?? null,
    refusedAt: s.refusedAt ?? null,
    ip: s.ip ?? null,
    ua: s.ua ?? null,
    acceptLanguage: s.acceptLanguage ?? null,
    authMode: s.authMode,
    geo: s.geo ?? null,
  }))

  const pdf = await renderEvidenciaPdf({
    contratoNumero: contrato.numero,
    clienteNome: contrato.cliente?.nome ?? '—',
    brandNome: empresa?.nomeFantasia || empresa?.razaoSocial || undefined,
    providerDocId: a.providerDocId,
    pdfOriginalHash: a.pdfOriginalHash ?? null,
    pdfAssinadoHash: a.pdfAssinadoHash ?? null,
    enviadoEm: a.enviadoEm,
    finalizadoEm: a.finalizadoEm,
    status: a.status,
    signatarios: signatariosEvid,
  })

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Evidencias-${contrato.numero}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
