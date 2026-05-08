/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 11, color: '#111' },
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

export function TemplatePdfDocument({ resolvedContent }: { resolvedContent: any }) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {renderBlock(resolvedContent, 'root')}
      </Page>
    </Document>
  )
}

export async function renderTemplateToPdfBuffer(resolvedContent: any): Promise<Buffer> {
  const instance = pdf(<TemplatePdfDocument resolvedContent={resolvedContent} />)
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
