/**
 * GET /api/boletos/export
 * Export boletos to Excel
 * Query params:
 * - ?status=aberto - filter by status ('aberto' | 'pago' | 'vencido' | 'cancelado')
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import {
  exportBoletosExcel,
  BoletoExportData,
} from '@/lib/excel-export-service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Build query
    const where: any = {
      cliente: {
        usuarioId: session.user.id,
      },
    }

    if (status) {
      where.status = status
    }

    const boletos = await db.boleto.findMany({
      where,
      include: {
        cliente: {
          select: {
            nome: true,
            cnpj: true,
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
      take: 1000, // Limit to 1000 rows
    })

    const exportData: BoletoExportData[] = boletos.map((b) => {
      const valor = typeof b.valor === 'number' ? b.valor : Number(b.valor)
      return {
        numero: b.numero,
        cliente: {
          nome: b.cliente.nome,
          cnpj: b.cliente.cnpj || undefined,
        },
        valor: valor,
        dataCriacao: b.criadoEm,
        dataVencimento: b.vencimento,
        status: b.status,
        link: b.linkBoleto || undefined,
      }
    })

    const buffer = await exportBoletosExcel(exportData)
    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Boletos-${timestamp}.xlsx"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error exporting boletos:', error)
    return NextResponse.json(
      {
        error: 'Erro ao exportar boletos',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
