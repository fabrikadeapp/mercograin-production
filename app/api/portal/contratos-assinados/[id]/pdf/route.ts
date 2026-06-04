/**
 * GET /api/portal/contratos-assinados/[id]/pdf
 * Retorna PDF do contrato — versão acessível ao cliente da corretora logado.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'
import { generateContratoPDFStream } from '@/lib/pdf-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const c = await db.contrato.findFirst({
    where: {
      id: params.id,
      clienteId: scope.clienteId,
      workspaceId: scope.workspaceId,
    },
    include: { cliente: true, proposta: true },
  })
  if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graos: any[] = Array.isArray(c.proposta?.graos)
    ? (c.proposta!.graos as any[])
    : []

  const pdf = await generateContratoPDFStream({
    numero: c.numero,
    propostaNumero: c.proposta?.numero ?? '—',
    propostaValor: c.proposta?.valorTotal ?? 0,
    statusAssinatura: c.statusAssinatura,
    clienteNome: c.cliente?.nome ?? '—',
    clienteCNPJ: c.cliente?.cnpj || undefined,
    clienteEmail: c.cliente?.email || undefined,
    dataInicio: c.dataInicio,
    dataFim: c.dataFim ?? undefined,
    graos,
    criadoEm: c.criadoEm,
  })

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Contrato-${c.numero}.pdf"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
