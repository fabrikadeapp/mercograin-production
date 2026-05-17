import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { generatePropostaPDFStream, PropostaPDFData } from '@/lib/pdf-service'

/**
 * GET /api/propostas/[id]/pdf
 * Generate and download PDF for a specific proposta
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

    // Fetch proposta with cliente info (multi-tenancy via Proposta.workspaceId)
    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            cnpj: true,
            email: true,
            endereco: true,
            workspaceId: true,
          },
        },
      },
    })

    if (!proposta) {
      return NextResponse.json(
        { error: 'Proposta não encontrada' },
        { status: 404 }
      )
    }

    // Parse graos from JSON
    const graos = Array.isArray(proposta.graos)
      ? (proposta.graos as Array<{
          grao: string
          quantidade: number
          preco: number
          subtotal: number
        }>)
      : []

    // Prepare PDF data
    const pdfData: PropostaPDFData = {
      numero: proposta.numero,
      status: proposta.status,
      tipo: proposta.tipo,
      clienteNome: proposta.cliente.nome,
      clienteCNPJ: proposta.cliente.cnpj || undefined,
      clienteEmail: proposta.cliente.email || undefined,
      clienteEndereco: proposta.cliente.endereco || undefined,
      graos,
      valorTotal: proposta.valorTotal,
      descricao: proposta.descricao || undefined,
      observacoes: proposta.observacoes || undefined,
      criadaEm: proposta.criadaEm,
      validadeEm: proposta.validadeEm,
    }

    // Generate PDF (returns Buffer directly — sem stream)
    const pdfBuffer = await generatePropostaPDFStream(pdfData)

    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Proposta-${proposta.numero}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Generate proposta PDF error:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar PDF da proposta' },
      { status: 500 }
    )
  }
}
