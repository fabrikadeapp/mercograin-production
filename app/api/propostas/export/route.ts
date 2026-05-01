/**
 * GET /api/propostas/export
 * Export propostas to Excel
 * Query params:
 * - ?format=list (default) - all propostas
 * - ?format=detailed&id=xxx - single proposta with details
 * - ?status=rascunho - filter by status
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import {
  exportPropostasToExcel,
  exportPropostaDetalhesExcel,
  PropostaExportData,
} from '@/lib/excel-export-service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'list'
    const status = searchParams.get('status')
    const id = searchParams.get('id')

    // Detailed export (single proposta)
    if (format === 'detailed' && id) {
      const proposta = await db.proposta.findUnique({
        where: { id },
        include: {
          cliente: {
            select: {
              nome: true,
              cnpj: true,
              email: true,
              usuarioId: true,
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

      // Verify ownership
      if (proposta.cliente.usuarioId !== session.user.id) {
        return NextResponse.json(
          { error: 'Acesso negado' },
          { status: 403 }
        )
      }

      const valor = typeof proposta.valorTotal === 'number'
        ? proposta.valorTotal
        : Number(proposta.valorTotal)

      const exportData: PropostaExportData = {
        numero: proposta.numero,
        cliente: {
          nome: proposta.cliente.nome,
          cnpj: proposta.cliente.cnpj || undefined,
          email: proposta.cliente.email || undefined,
        },
        tipo: proposta.tipo,
        graos: (Array.isArray(proposta.graos) ? proposta.graos : []) as any[],
        valorTotal: valor,
        descricao: proposta.descricao || undefined,
        observacoes: proposta.observacoes || undefined,
        criadaEm: proposta.criadaEm,
        validadeEm: proposta.validadeEm,
        status: proposta.status,
      }

      const buffer = await exportPropostaDetalhesExcel(exportData)

      return new NextResponse(buffer as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Proposta-${proposta.numero}.xlsx"`,
          'Content-Length': buffer.length.toString(),
        },
      })
    }

    // List export (all propostas with filters)
    const where: any = {
      cliente: {
        usuarioId: session.user.id,
      },
    }

    if (status) {
      where.status = status
    }

    const propostas = await db.proposta.findMany({
      where,
      include: {
        cliente: {
          select: {
            nome: true,
            cnpj: true,
            email: true,
          },
        },
      },
      orderBy: { criadaEm: 'desc' },
      take: 1000, // Limit to 1000 rows
    })

    const exportData: PropostaExportData[] = propostas.map((p) => {
      const valor = typeof p.valorTotal === 'number' ? p.valorTotal : Number(p.valorTotal)
      return {
        numero: p.numero,
        cliente: {
          nome: p.cliente.nome,
          cnpj: p.cliente.cnpj || undefined,
          email: p.cliente.email || undefined,
        },
        tipo: p.tipo,
        graos: (Array.isArray(p.graos) ? p.graos : []) as any[],
        valorTotal: valor,
        descricao: p.descricao || undefined,
        observacoes: p.observacoes || undefined,
        criadaEm: p.criadaEm,
        validadeEm: p.validadeEm,
        status: p.status,
      }
    })

    const buffer = await exportPropostasToExcel(exportData)
    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Propostas-${timestamp}.xlsx"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error exporting propostas:', error)
    return NextResponse.json(
      {
        error: 'Erro ao exportar propostas',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
