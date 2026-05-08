/**
 * GET /api/contratos/export
 * Export contratos to Excel
 * Query params:
 * - ?format=list (default) - all contratos
 * - ?format=detailed&id=xxx - single contrato with details
 * - ?status=assinado - filter by signature status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import {
  exportContratosExcel,
  ContratoExportData,
} from '@/lib/excel-export-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const format = searchParams.get('format') || 'list'
    const status = searchParams.get('status')
    const id = searchParams.get('id')

    // Detailed export (single contrato)
    if (format === 'detailed' && id) {
      const contrato = await db.contrato.findFirst({
        where: { id, ...scope.whereOwn() },
        include: {
          proposta: {
            select: {
              numero: true,
              graos: true,
              valorTotal: true,
            },
          },
          cliente: {
            select: {
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

      const valor = typeof contrato.proposta.valorTotal === 'number'
        ? contrato.proposta.valorTotal
        : Number(contrato.proposta.valorTotal)

      const exportData: ContratoExportData = {
        numero: contrato.numero,
        proposNumber: contrato.proposta.numero,
        cliente: {
          nome: contrato.cliente.nome,
          cnpj: contrato.cliente.cnpj || undefined,
          email: contrato.cliente.email || undefined,
        },
        graos: (Array.isArray(contrato.proposta.graos) ? contrato.proposta.graos : []) as any[],
        valorTotal: valor,
        dataInicio: contrato.dataInicio,
        dataFim: contrato.dataFim || undefined,
        statusAssinatura: contrato.statusAssinatura,
        criadoEm: contrato.criadoEm,
      }

      const buffer = await exportContratosExcel([exportData])

      return new NextResponse(buffer as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Contrato-${contrato.numero}.xlsx"`,
          'Content-Length': buffer.length.toString(),
        },
      })
    }

    // List export (all contratos with filters)
    const where: any = scope.whereOwn()

    if (status) {
      where.statusAssinatura = status
    }

    const contratos = await db.contrato.findMany({
      where,
      include: {
        proposta: {
          select: {
            numero: true,
            graos: true,
            valorTotal: true,
          },
        },
        cliente: {
          select: {
            nome: true,
            cnpj: true,
            email: true,
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
      take: 1000, // Limit to 1000 rows
    })

    const exportData: ContratoExportData[] = contratos.map((c) => {
      const valor = typeof c.proposta.valorTotal === 'number'
        ? c.proposta.valorTotal
        : Number(c.proposta.valorTotal)
      return {
        numero: c.numero,
        proposNumber: c.proposta.numero,
        cliente: {
          nome: c.cliente.nome,
          cnpj: c.cliente.cnpj || undefined,
          email: c.cliente.email || undefined,
        },
        graos: (Array.isArray(c.proposta.graos) ? c.proposta.graos : []) as any[],
        valorTotal: valor,
        dataInicio: c.dataInicio,
        dataFim: c.dataFim || undefined,
        statusAssinatura: c.statusAssinatura,
        criadoEm: c.criadoEm,
      }
    })

    const buffer = await exportContratosExcel(exportData)
    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Contratos-${timestamp}.xlsx"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error exporting contratos:', error)
    return NextResponse.json(
      {
        error: 'Erro ao exportar contratos',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
