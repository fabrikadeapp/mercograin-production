/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { PdfLogo } from './pdf-logo'
import { PdfTabelaGraos, type ItemGrao } from './pdf-tabela-graos'

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 48, fontFamily: 'Helvetica', fontSize: 11, color: '#111' },
  header: {
    position: 'absolute',
    top: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerMeta: { fontSize: 8, color: '#888', textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#888',
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: '#e0e0e0',
  },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 12, marginTop: 4 },
  h2: { fontSize: 14, fontWeight: 700, marginVertical: 10 },
  h3: { fontSize: 12, fontWeight: 700, marginVertical: 8 },
  p: { fontSize: 11, lineHeight: 1.55, marginBottom: 6 },
  list: { marginVertical: 6, paddingLeft: 16 },
  listItem: { fontSize: 11, lineHeight: 1.5, marginBottom: 3 },
  bold: { fontWeight: 700 },
  italic: { fontStyle: 'italic' },
  hr: { borderBottomWidth: 1, borderBottomColor: '#ccc', marginVertical: 10 },
})

function applyMarks(node: any) {
  const style: any = {}
  if (node.marks?.some((m: any) => m.type === 'bold')) Object.assign(style, styles.bold)
  if (node.marks?.some((m: any) => m.type === 'italic')) Object.assign(style, styles.italic)
  return style
}

function renderInline(node: any, key: any): any {
  if (!node) return null
  if (node.type === 'text') {
    return (
      <Text key={key} style={applyMarks(node)}>
        {node.text}
      </Text>
    )
  }
  if (node.type === 'hardBreak') {
    return <Text key={key}>{'\n'}</Text>
  }
  return null
}

function renderBlock(node: any, key: any): any {
  if (!node) return null

  switch (node.type) {
    case 'doc':
      return node.content?.map((c: any, i: number) => renderBlock(c, i))
    case 'heading': {
      const lvl = node.attrs?.level || 1
      const s = lvl === 1 ? styles.h1 : lvl === 2 ? styles.h2 : styles.h3
      return (
        <Text key={key} style={s}>
          {node.content?.map((c: any, i: number) => renderInline(c, i))}
        </Text>
      )
    }
    case 'paragraph':
      return (
        <Text key={key} style={styles.p}>
          {node.content?.map((c: any, i: number) => renderInline(c, i))}
        </Text>
      )
    case 'bulletList':
      return (
        <View key={key} style={styles.list}>
          {node.content?.map((li: any, i: number) => (
            <Text key={i} style={styles.listItem}>
              {'• '}
              {li.content?.flatMap((p: any, j: number) =>
                p.content?.map((c: any, k: number) => renderInline(c, `${j}-${k}`))
              )}
            </Text>
          ))}
        </View>
      )
    case 'orderedList':
      return (
        <View key={key} style={styles.list}>
          {node.content?.map((li: any, i: number) => (
            <Text key={i} style={styles.listItem}>
              {`${i + 1}. `}
              {li.content?.flatMap((p: any, j: number) =>
                p.content?.map((c: any, k: number) => renderInline(c, `${j}-${k}`))
              )}
            </Text>
          ))}
        </View>
      )
    case 'horizontalRule':
      return <View key={key} style={styles.hr} />
    case 'table': {
      // Simplified: render rows as paragraphs separated by | (TODO: real table layout)
      return (
        <View key={key} style={{ marginVertical: 6 }}>
          {node.content?.map((row: any, i: number) => (
            <Text key={i} style={styles.p}>
              {row.content
                ?.map((cell: any) =>
                  cell.content
                    ?.map((p: any) => p.content?.map((c: any) => c.text || '').join(''))
                    .join(' ')
                )
                .join(' | ')}
            </Text>
          ))}
        </View>
      )
    }
    default:
      // Fallback: try content
      if (Array.isArray(node.content)) {
        return node.content.map((c: any, i: number) => renderBlock(c, `${key}-${i}`))
      }
      return null
  }
}

export interface TemplatePdfDocumentProps {
  resolvedContent: any
  customLogoUrl?: string | null
  itensGrao?: ItemGrao[]
  documentTitle?: string
}

export function TemplatePdfDocument({
  resolvedContent,
  customLogoUrl,
  itensGrao,
  documentTitle,
}: TemplatePdfDocumentProps) {
  const generatedAt = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Header fixo no topo de cada página */}
        <View style={styles.header} fixed>
          <PdfLogo customLogoUrl={customLogoUrl ?? null} />
          <View>
            {documentTitle ? (
              <Text style={[styles.headerMeta, { fontWeight: 700, color: '#444' }]}>
                {documentTitle}
              </Text>
            ) : null}
            <Text style={styles.headerMeta}>Gerado em {generatedAt}</Text>
          </View>
        </View>

        {/* Tabela de grãos (se itens fornecidos) */}
        <PdfTabelaGraos items={itensGrao ?? []} />

        {/* Conteúdo Tiptap renderizado */}
        {renderBlock(resolvedContent, 'root')}

        {/* Footer fixo */}
        <View style={styles.footer} fixed>
          <Text>PHB Grain · Documento gerado eletronicamente</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

export async function renderTemplateToPdfBuffer(
  resolvedContent: any,
  options?: { customLogoUrl?: string | null; itensGrao?: ItemGrao[]; documentTitle?: string }
): Promise<Buffer> {
  const instance = pdf(
    <TemplatePdfDocument
      resolvedContent={resolvedContent}
      customLogoUrl={options?.customLogoUrl ?? null}
      itensGrao={options?.itensGrao}
      documentTitle={options?.documentTitle}
    />
  )
  // @react-pdf/renderer v4 supports toBuffer() returning a NodeJS.ReadableStream
  // We collect chunks into a Buffer.
  const stream = await instance.toBuffer()
  return await streamToBuffer(stream as any)
}

async function streamToBuffer(stream: NodeJS.ReadableStream | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) return stream
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}
