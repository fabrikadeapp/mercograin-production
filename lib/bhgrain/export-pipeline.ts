/**
 * BH Grain — Exportação do Pipeline (CSV + Excel).
 *
 * CSV: implementação puro Node, sem dependência (escapando aspas/vírgulas/quebras).
 * XLSX: usa ExcelJS já instalado no projeto.
 *
 * Ambos respeitam a mesma estrutura de colunas que o PipelineCard.
 */

import ExcelJS from 'exceljs'

export interface PipelineExportRow {
  clienteNome: string
  commodity: string
  quantidade: number | null
  unidade: string | null
  precoCotado: number | null
  valorTotal: number
  margemPercent: number | null
  scoreInterno: number | null
  status: string
  validadeEm: string | null
  previsaoCaixa: string | null
  proximaAcao: string | null
}

export interface PipelineExportKpis {
  valorTotalProposto: number
  previsaoReceita: number
  propostasAbertas: number
  clientesAtivos: number
}

const COLUMNS: { key: keyof PipelineExportRow | 'previsaoCaixaDate' | 'validadeEmDate'; label: string }[] = [
  { key: 'clienteNome', label: 'Cliente' },
  { key: 'commodity', label: 'Commodity' },
  { key: 'quantidade', label: 'Quantidade' },
  { key: 'unidade', label: 'Unidade' },
  { key: 'precoCotado', label: 'Preço cotado (R$/un)' },
  { key: 'valorTotal', label: 'Valor total (R$)' },
  { key: 'margemPercent', label: 'Margem %' },
  { key: 'scoreInterno', label: 'Score (0-100)' },
  { key: 'status', label: 'Status' },
  { key: 'validadeEm', label: 'Validade da proposta' },
  { key: 'previsaoCaixa', label: 'Previsão de caixa' },
  { key: 'proximaAcao', label: 'Próxima ação' },
]

function csvEscape(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function formatRowCsv(r: PipelineExportRow): string {
  return [
    csvEscape(r.clienteNome),
    csvEscape(r.commodity),
    csvEscape(r.quantidade ?? ''),
    csvEscape(r.unidade ?? ''),
    csvEscape(r.precoCotado != null ? r.precoCotado.toFixed(2) : ''),
    csvEscape(r.valorTotal.toFixed(2)),
    csvEscape(r.margemPercent != null ? r.margemPercent.toFixed(3) : ''),
    csvEscape(r.scoreInterno ?? ''),
    csvEscape(r.status),
    csvEscape(r.validadeEm ? r.validadeEm.slice(0, 10) : ''),
    csvEscape(r.previsaoCaixa ? r.previsaoCaixa.slice(0, 10) : ''),
    csvEscape(r.proximaAcao ?? ''),
  ].join(',')
}

export function exportPipelineCsv(rows: PipelineExportRow[], kpis: PipelineExportKpis): string {
  const header = COLUMNS.map((c) => csvEscape(c.label)).join(',')
  const dataLines = rows.map(formatRowCsv)

  // Linha-resumo em branco + KPIs no rodapé como observação (não atrapalha leitura em Excel)
  const footer = [
    '',
    `# Valor total proposto: R$ ${kpis.valorTotalProposto.toFixed(2)}`,
    `# Previsão de receita ponderada: R$ ${kpis.previsaoReceita.toFixed(2)}`,
    `# Propostas abertas: ${kpis.propostasAbertas}`,
    `# Clientes ativos: ${kpis.clientesAtivos}`,
    `# Gerado em ${new Date().toISOString()}`,
  ]

  return [header, ...dataLines, ...footer].join('\r\n')
}

export async function exportPipelineXlsx(
  rows: PipelineExportRow[],
  kpis: PipelineExportKpis
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'BH Grain'
  workbook.created = new Date()

  // ========================
  // Sheet 1: Pipeline
  // ========================
  const sheet = workbook.addWorksheet('Pipeline', {
    properties: { defaultColWidth: 18 },
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  sheet.columns = COLUMNS.map((c) => ({ header: c.label, key: String(c.key), width: 18 }))
  // Cabeçalho: estilo
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1D4ED8' },
  }
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' }

  for (const r of rows) {
    sheet.addRow({
      clienteNome: r.clienteNome,
      commodity: r.commodity,
      quantidade: r.quantidade,
      unidade: r.unidade,
      precoCotado: r.precoCotado,
      valorTotal: r.valorTotal,
      margemPercent: r.margemPercent != null ? r.margemPercent / 100 : null,
      scoreInterno: r.scoreInterno,
      status: r.status,
      validadeEm: r.validadeEm ? new Date(r.validadeEm) : null,
      previsaoCaixa: r.previsaoCaixa ? new Date(r.previsaoCaixa) : null,
      proximaAcao: r.proximaAcao,
    })
  }

  // Formatação por coluna
  const colMap: Record<string, string> = {
    precoCotado: '#,##0.00',
    valorTotal: 'R$ #,##0.00',
    margemPercent: '0.00%',
    scoreInterno: '0',
    validadeEm: 'dd/mm/yyyy',
    previsaoCaixa: 'dd/mm/yyyy',
  }
  for (const [key, fmt] of Object.entries(colMap)) {
    const col = sheet.getColumn(key)
    if (col) col.numFmt = fmt
  }

  // Auto-filter na primeira linha
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  }

  // ========================
  // Sheet 2: KPIs / Resumo
  // ========================
  const summary = workbook.addWorksheet('Resumo')
  summary.columns = [
    { header: 'Indicador', key: 'k', width: 35 },
    { header: 'Valor', key: 'v', width: 25 },
  ]
  summary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  summary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }

  summary.addRow({ k: 'Valor total proposto', v: kpis.valorTotalProposto })
  summary.addRow({ k: 'Previsão de receita ponderada', v: kpis.previsaoReceita })
  summary.addRow({ k: 'Propostas abertas', v: kpis.propostasAbertas })
  summary.addRow({ k: 'Clientes ativos', v: kpis.clientesAtivos })
  summary.addRow({ k: 'Gerado em', v: new Date() })

  const colV = summary.getColumn('v')
  colV.numFmt = 'R$ #,##0.00'
  // Linha "Propostas abertas" e "Clientes ativos" são inteiras
  summary.getCell('B4').numFmt = '0'
  summary.getCell('B5').numFmt = '0'
  summary.getCell('B6').numFmt = 'dd/mm/yyyy hh:mm'

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer as ArrayBuffer)
}
