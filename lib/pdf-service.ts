/**
 * PDF Service - Generate PDFs for Propostas and Contratos
 * Uses @react-pdf/renderer for server-side PDF generation
 */

import {
  Document,
  Page,
  View,
  Text,
  Image,
  renderToBuffer,
  renderToStream,
  Font,
} from '@react-pdf/renderer'
import React from 'react'
import { formatCurrency, formatDate, formatCNPJ } from './utils/formatters'

// Workaround do bug "Cannot read properties of null (reading 'write')" no
// @react-pdf/renderer em Node 22 + Railway. Forçamos hyphenation callback
// no-op (default tenta carregar wasm que pode falhar em sandbox).
Font.registerHyphenationCallback((word) => [word])

// Pré-aquecimento: tenta renderizar um documento mínimo no boot pra
// inicializar registries de fonts / dispatcher de stream.
let warmedUp = false
async function ensureWarmedUp() {
  if (warmedUp) return
  warmedUp = true
  // não bloqueia se falhar
  try {
    const { Document, Page, Text } = await import('@react-pdf/renderer')
    await renderToBuffer(
      React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          { size: 'A4' },
          React.createElement(Text, null, '.'),
        ),
      ) as any,
    )
  } catch (e) {
    console.warn('[pdf] warmup failed (non-fatal):', e)
  }
}

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
  /** Logo da corretora (workspace) — URL pública ou data URI. */
  brandLogoUrl?: string
  /** Nome da corretora para fallback quando não há logo. */
  brandNome?: string
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
    Document,
    { producer: data.brandNome ?? 'BH Grain', creator: data.brandNome ?? 'BH Grain System', title: `Proposta ${data.numero}` },
    React.createElement(
      Page,
      { size: 'A4', style: { padding: 40, fontFamily: 'Helvetica' } },

      // Header — logo (esquerda) + título (direita)
      React.createElement(
        View,
        {
          style: {
            marginBottom: 30,
            borderBottomWidth: 2,
            borderBottomColor: '#2563eb',
            paddingBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        },
        // Bloco esquerdo: logo (se houver) + nome
        React.createElement(
          View,
          { style: { flexDirection: 'row', alignItems: 'center', flex: 1 } },
          data.brandLogoUrl &&
            React.createElement(Image, {
              src: data.brandLogoUrl,
              style: { width: 80, height: 40, marginRight: 12, objectFit: 'contain' },
            }),
          data.brandNome && !data.brandLogoUrl &&
            React.createElement(
              Text,
              { style: { fontSize: 14, fontWeight: 'bold', color: '#1e40af', marginRight: 12 } },
              data.brandNome,
            ),
        ),
        // Bloco direito: título + meta
        React.createElement(
          View,
          { style: { alignItems: 'flex-end' } },
          React.createElement(Text, { style: { fontSize: 22, fontWeight: 'bold', color: '#1e40af' } }, 'PROPOSTA COMERCIAL'),
          React.createElement(
            Text,
            { style: { fontSize: 10, color: '#666', marginTop: 5 } },
            `Número: ${data.numero}`,
          ),
          React.createElement(
            Text,
            { style: { fontSize: 10, color: '#666' } },
            `Tipo: ${data.tipo === 'venda' ? 'Venda' : 'Compra'} · Status: ${data.status}`,
          ),
        ),
      ),

      // Client Info
      React.createElement(
        View,
        { style: { marginBottom: 20 } },
        React.createElement(Text, { style: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 } }, 'CLIENTE'),
        React.createElement(Text, { style: { fontSize: 11, color: '#333' } }, data.clienteNome),
        data.clienteCNPJ && React.createElement(Text, { style: { fontSize: 10, color: '#666' } }, `CNPJ: ${formatCNPJ(data.clienteCNPJ)}`),
        data.clienteEmail && React.createElement(Text, { style: { fontSize: 10, color: '#666' } }, `Email: ${data.clienteEmail}`),
        data.clienteEndereco && React.createElement(Text, { style: { fontSize: 10, color: '#666' } }, `Endereço: ${data.clienteEndereco}`)
      ),

      // Dates
      React.createElement(
        View,
        { style: { marginBottom: 20, display: 'flex', flexDirection: 'row', justifyContent: 'space-between' } },
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', color: '#666' } }, 'Data de Criação'),
          React.createElement(Text, { style: { fontSize: 11 } }, formatDate(data.criadaEm))
        ),
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', color: '#666' } }, 'Válida Até'),
          React.createElement(Text, { style: { fontSize: 11, fontWeight: 'bold', color: '#dc2626' } }, formatDate(data.validadeEm))
        )
      ),

      // Grains Table
      React.createElement(
        View,
        { style: { marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' } },
        // Header
        React.createElement(
          View,
          { style: { display: 'flex', flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#d1d5db' } },
          React.createElement(Text, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8 } }, 'Grão'),
          React.createElement(Text, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8, textAlign: 'right' } }, 'Quantidade'),
          React.createElement(Text, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8, textAlign: 'right' } }, 'Preço Unit.'),
          React.createElement(Text, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8, textAlign: 'right' } }, 'Subtotal')
        ),
        // Rows
        data.graos.map((grao, idx) =>
          React.createElement(
            View,
            { key: idx, style: { display: 'flex', flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6' } },
            React.createElement(Text, { style: { flex: 1, fontSize: 10, padding: 8 } }, grao.grao),
            React.createElement(Text, { style: { flex: 1, fontSize: 10, padding: 8, textAlign: 'right' } }, `${grao.quantidade.toLocaleString('pt-BR')}`),
            React.createElement(Text, { style: { flex: 1, fontSize: 10, padding: 8, textAlign: 'right' } }, formatCurrency(toNumber(grao.preco))),
            React.createElement(Text, { style: { flex: 1, fontSize: 10, padding: 8, textAlign: 'right', fontWeight: 'bold' } }, formatCurrency(toNumber(grao.subtotal)))
          )
        )
      ),

      // Total
      React.createElement(
        View,
        { style: { marginBottom: 20, display: 'flex', flexDirection: 'row', justifyContent: 'flex-end' } },
        React.createElement(
          View,
          { style: { width: 250, borderTopWidth: 2, borderTopColor: '#2563eb', paddingTop: 10 } },
          React.createElement(
            View,
            { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between' } },
            React.createElement(Text, { style: { fontSize: 12, fontWeight: 'bold' } }, 'VALOR TOTAL:'),
            React.createElement(Text, { style: { fontSize: 14, fontWeight: 'bold', color: '#2563eb' } }, formatCurrency(toNumber(data.valorTotal)))
          )
        )
      ),

      // Description & Notes
      data.descricao && React.createElement(
        View,
        { style: { marginBottom: 15 } },
        React.createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', marginBottom: 5 } }, 'DESCRIÇÃO'),
        React.createElement(Text, { style: { fontSize: 10, color: '#333', lineHeight: 1.4 } }, data.descricao)
      ),

      data.observacoes && React.createElement(
        View,
        { style: { marginBottom: 15 } },
        React.createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', marginBottom: 5 } }, 'OBSERVAÇÕES'),
        React.createElement(Text, { style: { fontSize: 10, color: '#666', lineHeight: 1.4 } }, data.observacoes)
      ),

      // Footer
      React.createElement(
        View,
        { style: { marginTop: 30, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', fontSize: 9, color: '#666', textAlign: 'center' } },
        React.createElement(Text, null, 'BH Grain - Sistema de Gestão de Grãos'),
        React.createElement(Text, { style: { marginTop: 3 } }, `Gerado em ${formatDate(new Date())} às ${new Date().toLocaleTimeString('pt-BR')}`)
      )
    )
  )
)

const ContratoDocument = ({ data }: { data: ContratoPDFData }) => (
  React.createElement(
    Document,
    { producer: 'BH Grain', creator: 'BH Grain System', title: `Contrato ${data.numero}` },
    React.createElement(
      Page,
      { size: 'A4', style: { padding: 40, fontFamily: 'Helvetica' } },

      // Header
      React.createElement(
        View,
        { style: { marginBottom: 30, borderBottomWidth: 2, borderBottomColor: '#16a34a', paddingBottom: 10 } },
        React.createElement(Text, { style: { fontSize: 24, fontWeight: 'bold', color: '#15803d' } }, 'CONTRATO DE COMPRA E VENDA'),
        React.createElement(Text, { style: { fontSize: 11, color: '#666', marginTop: 5 } }, `Número: ${data.numero} | Ref. Proposta: ${data.propostaNumero} | Status: ${data.statusAssinatura}`)
      ),

      // Client Info
      React.createElement(
        View,
        { style: { marginBottom: 20 } },
        React.createElement(Text, { style: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 } }, 'CONTRATANTE'),
        React.createElement(Text, { style: { fontSize: 11, color: '#333' } }, data.clienteNome),
        data.clienteCNPJ && React.createElement(Text, { style: { fontSize: 10, color: '#666' } }, `CNPJ: ${formatCNPJ(data.clienteCNPJ)}`),
        data.clienteEmail && React.createElement(Text, { style: { fontSize: 10, color: '#666' } }, `Email: ${data.clienteEmail}`)
      ),

      // Contract Dates
      React.createElement(
        View,
        { style: { marginBottom: 20, display: 'flex', flexDirection: 'row', justifyContent: 'space-between' } },
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', color: '#666' } }, 'Data de Início'),
          React.createElement(Text, { style: { fontSize: 11 } }, formatDate(data.dataInicio))
        ),
        data.dataFim && React.createElement(
          View,
          null,
          React.createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', color: '#666' } }, 'Data de Término'),
          React.createElement(Text, { style: { fontSize: 11 } }, formatDate(data.dataFim))
        ),
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', color: '#666' } }, 'Assinado em'),
          React.createElement(Text, { style: { fontSize: 11, color: data.statusAssinatura === 'assinado' ? '#16a34a' : '#dc2626' } }, data.statusAssinatura === 'assinado' ? '✓ Assinado' : 'Pendente Assinatura')
        )
      ),

      // Grains Table
      React.createElement(
        View,
        { style: { marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' } },
        React.createElement(
          View,
          { style: { display: 'flex', flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#d1d5db' } },
          React.createElement(Text, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8 } }, 'Grão'),
          React.createElement(Text, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8, textAlign: 'right' } }, 'Quantidade'),
          React.createElement(Text, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8, textAlign: 'right' } }, 'Preço Unit.'),
          React.createElement(Text, { style: { flex: 1, fontSize: 10, fontWeight: 'bold', padding: 8, textAlign: 'right' } }, 'Subtotal')
        ),
        data.graos.map((grao, idx) =>
          React.createElement(
            View,
            { key: idx, style: { display: 'flex', flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6' } },
            React.createElement(Text, { style: { flex: 1, fontSize: 10, padding: 8 } }, grao.grao),
            React.createElement(Text, { style: { flex: 1, fontSize: 10, padding: 8, textAlign: 'right' } }, `${grao.quantidade.toLocaleString('pt-BR')}`),
            React.createElement(Text, { style: { flex: 1, fontSize: 10, padding: 8, textAlign: 'right' } }, formatCurrency(toNumber(grao.preco))),
            React.createElement(Text, { style: { flex: 1, fontSize: 10, padding: 8, textAlign: 'right', fontWeight: 'bold' } }, formatCurrency(toNumber(grao.subtotal)))
          )
        )
      ),

      // Total
      React.createElement(
        View,
        { style: { marginBottom: 20, display: 'flex', flexDirection: 'row', justifyContent: 'flex-end' } },
        React.createElement(
          View,
          { style: { width: 250, borderTopWidth: 2, borderTopColor: '#16a34a', paddingTop: 10 } },
          React.createElement(
            View,
            { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between' } },
            React.createElement(Text, { style: { fontSize: 12, fontWeight: 'bold' } }, 'VALOR TOTAL:'),
            React.createElement(Text, { style: { fontSize: 14, fontWeight: 'bold', color: '#16a34a' } }, formatCurrency(toNumber(data.propostaValor)))
          )
        )
      ),

      // Terms
      React.createElement(
        View,
        { style: { marginBottom: 15 } },
        React.createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', marginBottom: 5 } }, 'TERMOS E CONDIÇÕES'),
        React.createElement(Text, { style: { fontSize: 9, color: '#666', lineHeight: 1.4 } },
          'Este contrato formaliza a compra e venda dos grãos listados acima nas quantidades, preços e condições especificadas. ' +
          'O pagamento deve ser efetuado conforme acordado. A entrega será realizada de acordo com os prazos estabelecidos. ' +
          'Ambas as partes concordam com os termos aqui descritos.'
        )
      ),

      // Signature Lines
      React.createElement(
        View,
        { style: { marginTop: 40, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#e5e7eb' } },
        React.createElement(
          View,
          { style: { width: '45%', textAlign: 'center' } },
          React.createElement(View, { style: { height: 40, marginBottom: 10 } }),
          React.createElement(Text, { style: { fontSize: 9, fontWeight: 'bold', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 5 } }, 'Assinatura do Cliente')
        ),
        React.createElement(
          View,
          { style: { width: '45%', textAlign: 'center' } },
          React.createElement(View, { style: { height: 40, marginBottom: 10 } }),
          React.createElement(Text, { style: { fontSize: 9, fontWeight: 'bold', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 5 } }, 'Assinatura da BH Grain')
        )
      ),

      // Footer
      React.createElement(
        View,
        { style: { marginTop: 30, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', fontSize: 9, color: '#666', textAlign: 'center' } },
        React.createElement(Text, null, 'BH Grain - Sistema de Gestão de Grãos'),
        React.createElement(Text, { style: { marginTop: 3 } }, `Gerado em ${formatDate(new Date())} às ${new Date().toLocaleTimeString('pt-BR')}`)
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
export async function generatePropostaPDFStream(data: PropostaPDFData): Promise<Buffer> {
  return renderPdfResiliente('proposta', () =>
    React.createElement(PropostaDocument, { data }) as any,
  )
}

/**
 * Generate PDF stream for Contrato
 */
export async function generateContratoPDFStream(data: ContratoPDFData): Promise<Buffer> {
  await ensureWarmedUp()
  return renderPdfResiliente('contrato', () =>
    React.createElement(ContratoDocument, { data }) as any,
  )
}

// ============================================================================
// CORE: render resiliente com fallback para renderToStream
// ============================================================================

/**
 * Renderiza um documento React-PDF para Buffer com camadas de fallback.
 *
 * Bug conhecido: `Cannot read properties of null (reading 'write')` no
 * PDFKit interno do @react-pdf acontece esporadicamente em sandboxes
 * serverless (Next.js App Router, Vercel/Railway) por causa de estado
 * compartilhado entre invocações.
 *
 * Estratégia (em camadas):
 *   1-3. renderToBuffer com warmup reset entre tentativas
 *   4-5. renderToStream + buffer manual (código path diferente)
 */
async function renderPdfResiliente(
  tipo: string,
  buildElement: () => React.ReactElement,
): Promise<Buffer> {
  await ensureWarmedUp()
  let lastErr: unknown = null

  // Camada A: renderToBuffer (mais rápido, mas mais propenso ao bug)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await renderToBuffer(buildElement())
    } catch (error) {
      lastErr = error
      console.warn(
        `[pdf] ${tipo} renderToBuffer attempt ${attempt}/3 falhou:`,
        error instanceof Error ? error.message : error,
      )
      warmedUp = false
      await ensureWarmedUp()
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt - 1)))
    }
  }

  // Camada B: renderToStream (código path diferente, fallback final)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const stream = await renderToStream(buildElement())
      const chunks: Buffer[] = []
      return await new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk: Buffer | string) => {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
        })
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', (err: unknown) =>
          reject(err instanceof Error ? err : new Error(String(err))),
        )
      })
    } catch (error) {
      lastErr = error
      console.warn(
        `[pdf] ${tipo} renderToStream attempt ${attempt}/2 falhou:`,
        error instanceof Error ? error.message : error,
      )
      warmedUp = false
      await ensureWarmedUp()
      await new Promise((r) => setTimeout(r, 200 * attempt))
    }
  }

  console.error(`[pdf] ${tipo} esgotou todas as tentativas:`, lastErr)
  throw new Error(`Falha ao gerar PDF do ${tipo}`)
}
