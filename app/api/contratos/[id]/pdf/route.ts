import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { generateContratoPDFStream, ContratoPDFData } from '@/lib/pdf-service'

/**
 * GET /api/contratos/[id]/pdf
 * Generate and download PDF for a specific contrato
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Fetch contrato with proposta and cliente info (multi-tenancy via Contrato.workspaceId)
    const contrato = await db.contrato.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: {
        proposta: {
          select: {
            numero: true,
            valorTotal: true,
            graos: true,
          },
        },
        cliente: {
          select: {
            id: true,
            nome: true,
            cnpj: true,
            email: true,
            workspaceId: true,
          },
        },
      },
    })

    if (!contrato) {
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      )
    }

    // Parse graos from proposta
    const graos = Array.isArray(contrato.proposta.graos)
      ? (contrato.proposta.graos as Array<{
          grao: string
          quantidade: number
          preco: number
          subtotal: number
        }>)
      : []

    // Prepare PDF data
    const pdfData: ContratoPDFData = {
      numero: contrato.numero,
      propostaNumero: contrato.proposta.numero,
      propostaValor: contrato.proposta.valorTotal,
      statusAssinatura: contrato.statusAssinatura,
      clienteNome: contrato.cliente.nome,
      clienteCNPJ: contrato.cliente.cnpj || undefined,
      clienteEmail: contrato.cliente.email || undefined,
      dataInicio: contrato.dataInicio,
      dataFim: contrato.dataFim || undefined,
      graos,
      criadoEm: contrato.criadoEm,
    }

    const pdfBuffer = await generateContratoPDFStream(pdfData)

    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Contrato-${contrato.numero}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Generate contrato PDF error:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar PDF do contrato' },
      { status: 500 }
    )
  }
}
