/**
 * PDF Service - Generate PDFs for Propostas and Contratos
 * Uses @react-pdf/renderer for server-side PDF generation
 */

import { renderToStream } from '@react-pdf/renderer'
import React from 'react'
import { formatCurrency, formatDate, formatCNPJ } from './utils/formatters'

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert Decimal or number to number
 */
function toNumber(value: any): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber()
  }
  return Number(value) || 0
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PropostaPDFData {
  numero: string
  status: string
  tipo: string
  clienteNome: string
  clienteCNPJ?: string
  clienteEmail?: string
  clienteEndereco?: string
  graos: Array<{
    grao: string
    quantidade: number
    preco: number
    subtotal: number
  }>
  valorTotal: any
  descricao?: string
  observacoes?: string
  criadaEm: Date
  validadeEm: Date
}

export interface ContratoPDFData {
  numero: string
  propostaNumero: string
  propostaValor: any
  statusAssinatura: string
  clienteNome: string
  clienteCNPJ?: string
  clienteEmail?: string
  dataInicio: Date
  dataFim?: Date
  graos: Array<{
    grao: string
    quantidade: number
    preco: number
    subtotal: number
  }>
  criadoEm: Date
}

// ============================================================================
// PDF COMPONENTS (React)
// ============================================================================

const PropostaDocument = ({ data }: { data: PropostaPDFData }) => (
  React.createElement(
    'Document' as any,
    { producer: 'MercoGrain', creator: 'MercoGrain System', title: `Proposta ${data.numero}` },
    React.createElement(
      'Page' as any,
      { size: 'A4', style: { padding: 40, fontFamily: 'Helvetica' } },

      // Header
      React.createElement(
        'View' as any,
        { style: { marginBottom: 30, borderBottomWidth: 2, borderBottomColor: '#2563eb', paddingBottom: 10 } },
        React.createElement('Text' as any, { style: { fontSize: 24, fontWeight: 'bold', color: '#1e40af' } }, 'PROPOSTA COMERCIAL'),
        React.createElement('Text' as any, { style: { fontSize: 11, color: '#666', marginTop: 5 } }, `Número: ${data.numero} | Tipo: ${data.tipo === 'venda' ? 'Venda' : 'Compra'} | Status: ${data.status}`)
      ),

      // Client Info
      React.createElement(
        'View' as any,
        { style: { marginBottom: 20 } },
        React.createElement('Text' as any, { style: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 } }, 'CLIENTE'),
        React.createElement('Text' as any, { style: { fontSize: 11, color: '#333' } }, data.clienteNome),
        data.clienteCNPJ && React.createElement('Text' as any, { style: { fontSize: 10, color: '#666' } }, `CNPJ: ${formatCNPJ(data.clienteCNPJ)}`),
        data.clienteEmail && React.createElement('Text' as any, { style: { fontSize: 10, color: '#666' } }, `Email: ${data.clienteEmail}`),
        data.clienteEndereco && React.createElement('Text' as any, { style: { fontSize: 10, color: '#666' } }, `Endereço: ${data.clienteEndereco}`)
      ),

      // Dates
      React.createElement(
        'View' as any,
        { style: { marginBottom: 20, display: 'flex', flexDirection: 'row', justifyContent: 'space-between' } },
        React.createElement(
          'View' as any,
          null,
          React.createElement('Text' as any, { style: { fontSize: 10, fontWeight: 'bold', color: '#666' } }, 'Data de Criação'),
          React.createElement('Text' as any, { style: { fontSize: 11 } }, formatDate(data.criadaEm))
        ),
        React.createElement(
          'View' as any,
          null,
          React.createElement('Text' as any, { style: { fontSize: 10, fontWeight: 'bold', color: '#666' } }, 'Válida Até'),
          React.createElement('Text' as any, { style: { fontSize: 11, fontWeight: 'bold', color: '#dc2626' } }, formatDate(data.validadeEm))
        )
      ),

      // Grains Table
      React.createElement(
        'View' as any,
        { style: { marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' } },
        // Header
        React.createElement(
          'View' as any,
          { style: { display: 'flex', flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#d1d5db' } },
          React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8 } }, 'Grão'),
          React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8, textAlign: 'right' } }, 'Quantidade'),
          React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8, textAlign: 'right' } }, 'Preço Unit.'),
          React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8, textAlign: 'right' } }, 'Subtotal')
        ),
        // Rows
        data.graos.map((grao, idx) =>
          React.createElement(
            'View' as any,
            { key: idx, style: { display: 'flex', flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6' } },
            React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, padding: 8 } }, grao.grao),
            React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, padding: 8, textAlign: 'right' } }, `${grao.quantidade.toLocaleString('pt-BR')}`),
            React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, padding: 8, textAlign: 'right' } }, formatCurrency(toNumber(grao.preco))),
            React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, padding: 8, textAlign: 'right', fontWeight: 'bold' } }, formatCurrency(toNumber(grao.subtotal)))
          )
        )
      ),

      // Total
      React.createElement(
        'View' as any,
        { style: { marginBottom: 20, display: 'flex', flexDirection: 'row', justifyContent: 'flex-end' } },
        React.createElement(
          'View' as any,
          { style: { width: 250, borderTopWidth: 2, borderTopColor: '#2563eb', paddingTop: 10 } },
          React.createElement(
            'View' as any,
            { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between' } },
            React.createElement('Text' as any, { style: { fontSize: 12, fontWeight: 'bold' } }, 'VALOR TOTAL:'),
            React.createElement('Text' as any, { style: { fontSize: 14, fontWeight: 'bold', color: '#2563eb' } }, formatCurrency(toNumber(data.valorTotal)))
          )
        )
      ),

      // Description & Notes
      data.descricao && React.createElement(
        'View' as any,
        { style: { marginBottom: 15 } },
        React.createElement('Text' as any, { style: { fontSize: 10, fontWeight: 'bold', marginBottom: 5 } }, 'DESCRIÇÃO'),
        React.createElement('Text' as any, { style: { fontSize: 10, color: '#333', lineHeight: 1.4 } }, data.descricao)
      ),

      data.observacoes && React.createElement(
        'View' as any,
        { style: { marginBottom: 15 } },
        React.createElement('Text' as any, { style: { fontSize: 10, fontWeight: 'bold', marginBottom: 5 } }, 'OBSERVAÇÕES'),
        React.createElement('Text' as any, { style: { fontSize: 10, color: '#666', lineHeight: 1.4 } }, data.observacoes)
      ),

      // Footer
      React.createElement(
        'View' as any,
        { style: { marginTop: 30, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', fontSize: 9, color: '#666', textAlign: 'center' } },
        React.createElement('Text' as any, null, 'MercoGrain - Sistema de Gestão de Grãos'),
        React.createElement('Text' as any, { style: { marginTop: 3 } }, `Gerado em ${formatDate(new Date())} às ${new Date().toLocaleTimeString('pt-BR')}`)
      )
    )
  )
)

const ContratoDocument = ({ data }: { data: ContratoPDFData }) => (
  React.createElement(
    'Document' as any,
    { producer: 'MercoGrain', creator: 'MercoGrain System', title: `Contrato ${data.numero}` },
    React.createElement(
      'Page' as any,
      { size: 'A4', style: { padding: 40, fontFamily: 'Helvetica' } },

      // Header
      React.createElement(
        'View' as any,
        { style: { marginBottom: 30, borderBottomWidth: 2, borderBottomColor: '#16a34a', paddingBottom: 10 } },
        React.createElement('Text' as any, { style: { fontSize: 24, fontWeight: 'bold', color: '#15803d' } }, 'CONTRATO DE COMPRA E VENDA'),
        React.createElement('Text' as any, { style: { fontSize: 11, color: '#666', marginTop: 5 } }, `Número: ${data.numero} | Ref. Proposta: ${data.propostaNumero} | Status: ${data.statusAssinatura}`)
      ),

      // Client Info
      React.createElement(
        'View' as any,
        { style: { marginBottom: 20 } },
        React.createElement('Text' as any, { style: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 } }, 'CONTRATANTE'),
        React.createElement('Text' as any, { style: { fontSize: 11, color: '#333' } }, data.clienteNome),
        data.clienteCNPJ && React.createElement('Text' as any, { style: { fontSize: 10, color: '#666' } }, `CNPJ: ${formatCNPJ(data.clienteCNPJ)}`),
        data.clienteEmail && React.createElement('Text' as any, { style: { fontSize: 10, color: '#666' } }, `Email: ${data.clienteEmail}`)
      ),

      // Contract Dates
      React.createElement(
        'View' as any,
        { style: { marginBottom: 20, display: 'flex', flexDirection: 'row', justifyContent: 'space-between' } },
        React.createElement(
          'View' as any,
          null,
          React.createElement('Text' as any, { style: { fontSize: 10, fontWeight: 'bold', color: '#666' } }, 'Data de Início'),
          React.createElement('Text' as any, { style: { fontSize: 11 } }, formatDate(data.dataInicio))
        ),
        data.dataFim && React.createElement(
          'View' as any,
          null,
          React.createElement('Text' as any, { style: { fontSize: 10, fontWeight: 'bold', color: '#666' } }, 'Data de Término'),
          React.createElement('Text' as any, { style: { fontSize: 11 } }, formatDate(data.dataFim))
        ),
        React.createElement(
          'View' as any,
          null,
          React.createElement('Text' as any, { style: { fontSize: 10, fontWeight: 'bold', color: '#666' } }, 'Assinado em'),
          React.createElement('Text' as any, { style: { fontSize: 11, color: data.statusAssinatura === 'assinado' ? '#16a34a' : '#dc2626' } }, data.statusAssinatura === 'assinado' ? '✓ Assinado' : 'Pendente Assinatura')
        )
      ),

      // Grains Table
      React.createElement(
        'View' as any,
        { style: { marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' } },
        React.createElement(
          'View' as any,
          { style: { display: 'flex', flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#d1d5db' } },
          React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8 } }, 'Grão'),
          React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8, textAlign: 'right' } }, 'Quantidade'),
          React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8, textAlign: 'right' } }, 'Preço Unit.'),
          React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8, textAlign: 'right' } }, 'Subtotal')
        ),
        data.graos.map((grao, idx) =>
          React.createElement(
            'View' as any,
            { key: idx, style: { display: 'flex', flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6' } },
            React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, padding: 8 } }, grao.grao),
            React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, padding: 8, textAlign: 'right' } }, `${grao.quantidade.toLocaleString('pt-BR')}`),
            React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, padding: 8, textAlign: 'right' } }, formatCurrency(toNumber(grao.preco))),
            React.createElement('Text' as any, { style: { flex: 1, fontSize: 10, padding: 8, textAlign: 'right', fontWeight: 'bold' } }, formatCurrency(toNumber(grao.subtotal)))
          )
        )
      ),

      // Total
      React.createElement(
        'View' as any,
        { style: { marginBottom: 20, display: 'flex', flexDirection: 'row', justifyContent: 'flex-end' } },
        React.createElement(
          'View' as any,
          { style: { width: 250, borderTopWidth: 2, borderTopColor: '#16a34a', paddingTop: 10 } },
          React.createElement(
            'View' as any,
            { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between' } },
            React.createElement('Text' as any, { style: { fontSize: 12, fontWeight: 'bold' } }, 'VALOR TOTAL:'),
            React.createElement('Text' as any, { style: { fontSize: 14, fontWeight: 'bold', color: '#16a34a' } }, formatCurrency(toNumber(data.propostaValor)))
          )
        )
      ),

      // Terms
      React.createElement(
        'View' as any,
        { style: { marginBottom: 15 } },
        React.createElement('Text' as any, { style: { fontSize: 10, fontWeight: 'bold', marginBottom: 5 } }, 'TERMOS E CONDIÇÕES'),
        React.createElement('Text' as any, { style: { fontSize: 9, color: '#666', lineHeight: 1.4 } },
          'Este contrato formaliza a compra e venda dos grãos listados acima nas quantidades, preços e condições especificadas. ' +
          'O pagamento deve ser efetuado conforme acordado. A entrega será realizada de acordo com os prazos estabelecidos. ' +
          'Ambas as partes concordam com os termos aqui descritos.'
        )
      ),

      // Signature Lines
      React.createElement(
        'View' as any,
        { style: { marginTop: 40, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#e5e7eb' } },
        React.createElement(
          'View' as any,
          { style: { width: '45%', textAlign: 'center' } },
          React.createElement('View' as any, { style: { height: 40, marginBottom: 10 } }),
          React.createElement('Text' as any, { style: { fontSize: 9, fontWeight: 'bold', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 5 } }, 'Assinatura do Cliente')
        ),
        React.createElement(
          'View' as any,
          { style: { width: '45%', textAlign: 'center' } },
          React.createElement('View' as any, { style: { height: 40, marginBottom: 10 } }),
          React.createElement('Text' as any, { style: { fontSize: 9, fontWeight: 'bold', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 5 } }, 'Assinatura da MercoGrain')
        )
      ),

      // Footer
      React.createElement(
        'View' as any,
        { style: { marginTop: 30, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', fontSize: 9, color: '#666', textAlign: 'center' } },
        React.createElement('Text' as any, null, 'MercoGrain - Sistema de Gestão de Grãos'),
        React.createElement('Text' as any, { style: { marginTop: 3 } }, `Gerado em ${formatDate(new Date())} às ${new Date().toLocaleTimeString('pt-BR')}`)
      )
    )
  )
)

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Generate PDF stream for Proposta
 */
export async function generatePropostaPDFStream(data: PropostaPDFData) {
  try {
    const stream = await renderToStream(
      React.createElement(PropostaDocument, { data }) as any
    )
    return stream
  } catch (error) {
    console.error('Error generating proposta PDF:', error)
    throw new Error('Falha ao gerar PDF da proposta')
  }
}

/**
 * Generate PDF stream for Contrato
 */
export async function generateContratoPDFStream(data: ContratoPDFData) {
  try {
    const stream = await renderToStream(
      React.createElement(ContratoDocument, { data }) as any
    )
    return stream
  } catch (error) {
    console.error('Error generating contrato PDF:', error)
    throw new Error('Falha ao gerar PDF do contrato')
  }
}
