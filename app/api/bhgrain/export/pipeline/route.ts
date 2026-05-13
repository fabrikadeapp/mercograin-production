/**
 * GET /api/bhgrain/export/pipeline?format=csv|xlsx
 *
 * Exporta o Pipeline BH Grain do workspace ativo.
 * Reusa o builder dashboard-resumo (mesma fonte de dados que a UI exibe).
 * Aplica filtros opcionais via query (status, commodity, ordering).
 *
 * Permissão: export_reports.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import { buildDashboardResumo } from '@/lib/bhgrain/dashboard-resumo'
import { exportPipelineCsv, exportPipelineXlsx, type PipelineExportRow } from '@/lib/bhgrain/export-pipeline'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80)
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireBhGrainScope()
    scope.require('export_reports')

    const { searchParams } = new URL(request.url)
    const format = (searchParams.get('format') ?? 'csv').toLowerCase()
    if (format !== 'csv' && format !== 'xlsx') {
      return NextResponse.json({ error: 'format inválido (use csv ou xlsx)' }, { status: 400 })
    }

    const resumo = await buildDashboardResumo(scope.workspaceId)
    const statusFilter = searchParams.get('status')?.toLowerCase() ?? null
    const commodityFilter = searchParams.get('commodity')?.toLowerCase() ?? null

    const rows: PipelineExportRow[] = resumo.pipeline
      .filter((r) => (statusFilter ? r.status.toLowerCase() === statusFilter : true))
      .filter((r) => (commodityFilter ? r.commodity.toLowerCase().includes(commodityFilter) : true))
      .map((r) => ({
        clienteNome: r.clienteNome,
        commodity: r.commodity,
        quantidade: r.quantidade,
        unidade: r.unidade,
        precoCotado: r.precoCotado,
        valorTotal: r.valorTotal,
        margemPercent: r.margemPercent,
        scoreInterno: r.scoreInterno,
        status: r.status,
        validadeEm: r.validadeEm,
        previsaoCaixa: r.previsaoCaixa,
        proximaAcao: r.proximaAcao,
      }))

    const today = new Date().toISOString().slice(0, 10)
    const baseName = sanitizeFilename(`bhgrain_pipeline_${today}`)

    if (format === 'csv') {
      const csv = exportPipelineCsv(rows, resumo.kpis)
      // BOM para Excel reconhecer UTF-8
      const body = '﻿' + csv
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseName}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // xlsx
    const buffer = await exportPipelineXlsx(rows, resumo.kpis)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg.includes('autoriz') ? 401 : msg.includes('Permissão') || msg.includes('Acesso') ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
