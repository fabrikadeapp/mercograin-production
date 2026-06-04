/**
 * GET /api/portal/contratos-assinados
 * Lista contratos do cliente logado com status de assinatura e links para
 * download do contrato e da página de evidências.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const contratos = await db.contrato.findMany({
    where: {
      clienteId: scope.clienteId,
      workspaceId: scope.workspaceId,
    },
    orderBy: { criadoEm: 'desc' },
    take: 200,
    select: {
      id: true,
      numero: true,
      statusAssinatura: true,
      assinadoEm: true,
      criadoEm: true,
      pdfHash: true,
      assinaturaDigital: {
        select: {
          status: true,
          providerDocId: true,
          finalizadoEm: true,
        },
      },
      proposta: {
        select: { numero: true, valorTotal: true, tipo: true },
      },
    },
  })

  const items = contratos.map((c) => ({
    id: c.id,
    numero: c.numero,
    statusAssinatura: c.statusAssinatura,
    assinadoEm: c.assinadoEm,
    criadoEm: c.criadoEm,
    pdfHash: c.pdfHash,
    propostaNumero: c.proposta?.numero ?? null,
    propostaValor: c.proposta?.valorTotal ? Number(c.proposta.valorTotal) : null,
    propostaTipo: c.proposta?.tipo ?? null,
    providerDocId: c.assinaturaDigital?.providerDocId ?? null,
    finalizadoEm: c.assinaturaDigital?.finalizadoEm ?? null,
    // Endpoints úteis na UI
    downloadContrato: `/api/portal/contratos-assinados/${c.id}/pdf`,
    downloadEvidencias: `/api/portal/contratos-assinados/${c.id}/evidencias`,
  }))

  return NextResponse.json({ ok: true, contratos: items })
}
