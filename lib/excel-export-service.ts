/**
 * Excel Export Service - Generate professional Excel files
 * - Propostas (proposals)
 * - Contratos (contracts)
 * - Boletos (invoices)
 * - Bulk exports
 */

import ExcelJS from 'exceljs'
import { formatCurrency, formatDate } from './utils/formatters'

export interface PropostaExportData {
  numero: string
  cliente: {
    nome: string
    cnpj?: string
    email?: string
  }
  tipo: string
  graos: Array<{
    grao: string
    quantidade: number
    preco: number
    subtotal: number
  }>
  valorTotal: number | any
  descricao?: string
  observacoes?: string
  criadaEm: Date
  validadeEm: Date
  status: string
}

export interface ContratoExportData {
  numero: string
  proposNumber: string
  cliente: {
    nome: string
    cnpj?: string
    email?: string
  }
  graos: Array<{
    grao: string
    quantidade: number
    preco: number
    subtotal: number
  }>
  valorTotal: number | any
  dataInicio: Date
  dataFim?: Date
  statusAssinatura: string
  criadoEm: Date
}

export interface BoletoExportData {
  numero: string
  cliente: {
    nome: string
    cnpj?: string
  }
  valor: number | any
  dataCriacao: Date
  dataVencimento: Date
  status: string
  link?: string
}

/**
 * Create Excel workbook with styling
 */
function createWorkbook() {
  const workbook = new ExcelJS.Workbook()

  // Define styles
  const headerStyle = {
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }, // Blue
    },
    font: {
      bold: true,
      color: { argb: 'FFFFFFFF' }, // White
      size: 11,
    },
    alignment: { horizontal: 'center' as any, vertical: 'middle' as any, wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
  }

  const dataStyle = {
    alignment: { horizontal: 'left' as any, vertical: 'middle' as any },
    border: {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    },
  }

  const currencyStyle = {
    ...dataStyle,
    numFmt: '"R$ "#,##0.00',
    alignment: { horizontal: 'right' as any, vertical: 'middle' as any },
  }

  const dateStyle = {
    ...dataStyle,
    numFmt: 'dd/mm/yyyy',
  }

  return { workbook, headerStyle, dataStyle, currencyStyle, dateStyle }
}

/**
 * Export propostas to Excel
 */
export async function exportPropostasToExcel(propostas: PropostaExportData[]): Promise<Buffer> {
  const { workbook, headerStyle, dataStyle, currencyStyle, dateStyle } = createWorkbook()

  const worksheet = workbook.addWorksheet('Propostas', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  })

  // Title
  worksheet.mergeCells('A1:H1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = 'RELATÓRIO DE PROPOSTAS'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E40AF' } }
  titleCell.alignment = { horizontal: 'center' as any, vertical: 'middle' as any }
  worksheet.getRow(1).height = 25

  // Subtitle with date
  worksheet.mergeCells('A2:H2')
  const subtitleCell = worksheet.getCell('A2')
  subtitleCell.value = `Gerado em ${formatDate(new Date())}`
  subtitleCell.font = { size: 10, color: { argb: 'FF666666' } }
  subtitleCell.alignment = { horizontal: 'center' }

  // Headers
  const headers = ['Número', 'Cliente', 'CNPJ', 'Tipo', 'Status', 'Valor Total', 'Data Criação', 'Validade']
  worksheet.addRow(headers)
  const headerRow = worksheet.getRow(4)
  headerRow.height = 20
  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1)
    Object.assign(cell, headerStyle)
  })

  // Data rows
  propostas.forEach((proposta) => {
    const valor = typeof proposta.valorTotal === 'number' ? proposta.valorTotal : Number(proposta.valorTotal)
    const row = worksheet.addRow([
      proposta.numero,
      proposta.cliente.nome,
      proposta.cliente.cnpj || '',
      proposta.tipo === 'venda' ? 'Venda' : 'Compra',
      proposta.status,
      valor,
      proposta.criadaEm,
      proposta.validadeEm,
    ])

    row.getCell(6).numFmt = '"R$ "#,##0.00'
    row.getCell(7).numFmt = 'dd/mm/yyyy'
    row.getCell(8).numFmt = 'dd/mm/yyyy'

    row.eachCell((cell) => {
      Object.assign(cell, dataStyle)
    })
  })

  // Set column widths
  worksheet.columns = [
    { width: 12 },
    { width: 20 },
    { width: 18 },
    { width: 10 },
    { width: 12 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
  ]

  // Freeze header
  worksheet.views = [{ state: 'frozen', ySplit: 4 }]

  return (await workbook.xlsx.writeBuffer()) as any as Buffer
}

/**
 * Export detailed proposta with grains
 */
export async function exportPropostaDetalhesExcel(proposta: PropostaExportData): Promise<Buffer> {
  const { workbook, headerStyle, dataStyle, currencyStyle } = createWorkbook()

  const worksheet = workbook.addWorksheet('Proposta', {
    pageSetup: { paperSize: 9, orientation: 'portrait' },
  })

  let row = 1

  // Header
  worksheet.mergeCells(`A${row}:D${row}`)
  const header = worksheet.getCell(`A${row}`)
  header.value = 'PROPOSTA COMERCIAL'
  header.font = { bold: true, size: 14, color: { argb: 'FF1E40AF' } }
  header.alignment = { horizontal: 'center' }
  row += 2

  // Proposta info
  worksheet.getCell(`A${row}`).value = 'Número:'
  worksheet.getCell(`B${row}`).value = proposta.numero
  worksheet.getCell(`C${row}`).value = 'Status:'
  worksheet.getCell(`D${row}`).value = proposta.status
  row += 1

  worksheet.getCell(`A${row}`).value = 'Cliente:'
  worksheet.getCell(`B${row}`).value = proposta.cliente.nome
  row += 1

  worksheet.getCell(`A${row}`).value = 'CNPJ:'
  worksheet.getCell(`B${row}`).value = proposta.cliente.cnpj || ''
  worksheet.getCell(`C${row}`).value = 'Email:'
  worksheet.getCell(`D${row}`).value = proposta.cliente.email || ''
  row += 2

  // Grains table
  const grainsHeaders = ['Grão', 'Quantidade', 'Preço Unit.', 'Subtotal']
  const headerRow = worksheet.addRow(grainsHeaders)
  grainsHeaders.forEach((_, idx) => {
    headerRow.getCell(idx + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    headerRow.getCell(idx + 1).font = { bold: true }
  })
  row += 1

  proposta.graos.forEach((grao) => {
    const grainRow = worksheet.addRow([
      grao.grao,
      grao.quantidade,
      grao.preco,
      grao.subtotal,
    ])
    grainRow.getCell(3).numFmt = '"R$ "#,##0.00'
    grainRow.getCell(4).numFmt = '"R$ "#,##0.00'
  })

  row += proposta.graos.length + 1

  // Total
  worksheet.getCell(`C${row}`).value = 'TOTAL:'
  worksheet.getCell(`C${row}`).font = { bold: true }
  const valor = typeof proposta.valorTotal === 'number' ? proposta.valorTotal : Number(proposta.valorTotal)
  worksheet.getCell(`D${row}`).value = valor
  worksheet.getCell(`D${row}`).numFmt = '"R$ "#,##0.00'
  worksheet.getCell(`D${row}`).font = { bold: true, color: { argb: 'FF2563EB' }, size: 12 }

  row += 2

  // Dates
  worksheet.getCell(`A${row}`).value = 'Criada em:'
  worksheet.getCell(`B${row}`).value = proposta.criadaEm
  worksheet.getCell(`B${row}`).numFmt = 'dd/mm/yyyy'
  worksheet.getCell(`C${row}`).value = 'Válida até:'
  worksheet.getCell(`D${row}`).value = proposta.validadeEm
  worksheet.getCell(`D${row}`).numFmt = 'dd/mm/yyyy'

  row += 2

  // Notes
  if (proposta.descricao) {
    worksheet.getCell(`A${row}`).value = 'Descrição:'
    worksheet.getCell(`B${row}`).value = proposta.descricao
    row += 2
  }

  if (proposta.observacoes) {
    worksheet.getCell(`A${row}`).value = 'Observações:'
    worksheet.getCell(`B${row}`).value = proposta.observacoes
  }

  worksheet.columns = [{ width: 15 }, { width: 20 }, { width: 15 }, { width: 15 }]

  return (await workbook.xlsx.writeBuffer()) as any as Buffer
}

/**
 * Export contratos to Excel
 */
export async function exportContratosExcel(contratos: ContratoExportData[]): Promise<Buffer> {
  const { workbook, headerStyle, dataStyle } = createWorkbook()

  const worksheet = workbook.addWorksheet('Contratos')

  // Title
  worksheet.mergeCells('A1:H1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = 'RELATÓRIO DE CONTRATOS'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF15803D' } }
  titleCell.alignment = { horizontal: 'center' }
  worksheet.getRow(1).height = 25

  // Headers
  const headers = ['Número', 'Proposta', 'Cliente', 'Status', 'Valor', 'Início', 'Término', 'Assinatura']
  worksheet.addRow(headers)
  const headerRow = worksheet.getRow(3)
  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1)
    Object.assign(cell, headerStyle)
  })

  // Data rows
  contratos.forEach((contrato) => {
    const valor = typeof contrato.valorTotal === 'number' ? contrato.valorTotal : Number(contrato.valorTotal)
    const row = worksheet.addRow([
      contrato.numero,
      contrato.proposNumber,
      contrato.cliente.nome,
      contrato.statusAssinatura,
      valor,
      contrato.dataInicio,
      contrato.dataFim || '',
      contrato.statusAssinatura === 'assinado' ? 'Sim' : 'Não',
    ])

    row.getCell(5).numFmt = '"R$ "#,##0.00'
    row.getCell(6).numFmt = 'dd/mm/yyyy'
    row.getCell(7).numFmt = 'dd/mm/yyyy'

    row.eachCell((cell) => {
      Object.assign(cell, dataStyle)
    })
  })

  worksheet.columns = [
    { width: 12 },
    { width: 12 },
    { width: 20 },
    { width: 12 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 12 },
  ]

  worksheet.views = [{ state: 'frozen', ySplit: 3 }]

  return (await workbook.xlsx.writeBuffer()) as any as Buffer
}

/**
 * Export boletos to Excel
 */
export async function exportBoletosExcel(boletos: BoletoExportData[]): Promise<Buffer> {
  const { workbook, headerStyle, dataStyle } = createWorkbook()

  const worksheet = workbook.addWorksheet('Boletos')

  // Title
  worksheet.mergeCells('A1:G1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = 'RELATÓRIO DE BOLETOS/FATURAS'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFC2410C' } }
  titleCell.alignment = { horizontal: 'center' }
  worksheet.getRow(1).height = 25

  // Headers
  const headers = ['Número', 'Cliente', 'Valor', 'Data Criação', 'Vencimento', 'Status', 'Link']
  worksheet.addRow(headers)
  const headerRow = worksheet.getRow(3)
  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1)
    Object.assign(cell, headerStyle)
  })

  // Data rows
  boletos.forEach((boleto) => {
    const valor = typeof boleto.valor === 'number' ? boleto.valor : Number(boleto.valor)
    const row = worksheet.addRow([
      boleto.numero,
      boleto.cliente.nome,
      valor,
      boleto.dataCriacao,
      boleto.dataVencimento,
      boleto.status,
      boleto.link || '',
    ])

    row.getCell(3).numFmt = '"R$ "#,##0.00'
    row.getCell(4).numFmt = 'dd/mm/yyyy'
    row.getCell(5).numFmt = 'dd/mm/yyyy'

    // Add hyperlink if available
    if (boleto.link) {
      row.getCell(7).value = { text: 'Abrir', hyperlink: boleto.link }
      row.getCell(7).font = { color: { argb: 'FF2563EB' }, underline: 'single' }
    }

    row.eachCell((cell) => {
      Object.assign(cell, dataStyle)
    })
  })

  worksheet.columns = [
    { width: 12 },
    { width: 20 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 12 },
    { width: 20 },
  ]

  worksheet.views = [{ state: 'frozen', ySplit: 3 }]

  return (await workbook.xlsx.writeBuffer()) as any as Buffer
}

/**
 * Export summary sheet with multiple types
 */
export async function exportSummarySheetsExcel(
  propostas: PropostaExportData[],
  contratos: ContratoExportData[],
  boletos: BoletoExportData[]
): Promise<Buffer> {
  const { workbook } = createWorkbook()

  // Add propostas sheet
  if (propostas.length > 0) {
    const propWorksheet = workbook.addWorksheet('Propostas')
    const propBuffer = await exportPropostasToExcel(propostas)
    // Copy data to worksheet
    const propWorkbook = new ExcelJS.Workbook()
    await propWorkbook.xlsx.load(propBuffer as any)
    const propSheet = propWorkbook.worksheets[0]
    propSheet.eachRow((row, rowNum) => {
      const newRow = propWorksheet.addRow(row.values)
      row.eachCell((cell, colNum) => {
        const newCell = newRow.getCell(colNum)
        if (cell.fill) newCell.fill = cell.fill
        if (cell.font) newCell.font = cell.font
        if (cell.alignment) newCell.alignment = cell.alignment
        if (cell.border) newCell.border = cell.border
      })
    })
  }

  // Add contratos sheet
  if (contratos.length > 0) {
    const conWorksheet = workbook.addWorksheet('Contratos')
    const conBuffer = await exportContratosExcel(contratos)
    const conWorkbook = new ExcelJS.Workbook()
    await conWorkbook.xlsx.load(conBuffer as any)
    const conSheet = conWorkbook.worksheets[0]
    conSheet.eachRow((row, rowNum) => {
      const newRow = conWorksheet.addRow(row.values)
      row.eachCell((cell, colNum) => {
        const newCell = newRow.getCell(colNum)
        if (cell.fill) newCell.fill = cell.fill
        if (cell.font) newCell.font = cell.font
        if (cell.alignment) newCell.alignment = cell.alignment
      })
    })
  }

  // Add boletos sheet
  if (boletos.length > 0) {
    const bolWorksheet = workbook.addWorksheet('Boletos')
    const bolBuffer = await exportBoletosExcel(boletos)
    const bolWorkbook = new ExcelJS.Workbook()
    await bolWorkbook.xlsx.load(bolBuffer as any)
    const bolSheet = bolWorkbook.worksheets[0]
    bolSheet.eachRow((row, rowNum) => {
      const newRow = bolWorksheet.addRow(row.values)
      row.eachCell((cell, colNum) => {
        const newCell = newRow.getCell(colNum)
        if (cell.fill) newCell.fill = cell.fill
        if (cell.font) newCell.font = cell.font
        if (cell.alignment) newCell.alignment = cell.alignment
      })
    })
  }

  return (await workbook.xlsx.writeBuffer()) as any as Buffer
}
