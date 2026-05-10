/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * S5 M9 — Gerador PDF Due Diligence Statement (EUDR Annex II).
 */
import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111',
  },
  header: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 8 },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#666' },
  section: { marginTop: 14 },
  h2: { fontSize: 12, fontWeight: 700, marginBottom: 6, backgroundColor: '#f3f4f6', padding: 4 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 140, fontWeight: 700, color: '#444' },
  value: { flex: 1 },
  table: { marginTop: 4, borderWidth: 0.5, borderColor: '#ccc' },
  th: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    fontSize: 9,
    fontWeight: 700,
  },
  tr: { flexDirection: 'row', borderBottomWidth: 0.25, borderBottomColor: '#eee', fontSize: 9 },
  td: { padding: 4, flex: 1 },
  riskBox: { marginTop: 6, padding: 8, borderWidth: 1, borderRadius: 3 },
  riskCritico: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  riskAlto: { borderColor: '#ea580c', backgroundColor: '#fff7ed' },
  riskMedio: { borderColor: '#ca8a04', backgroundColor: '#fefce8' },
  riskBaixo: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#888',
    textAlign: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#ddd',
    paddingTop: 6,
  },
})

export interface DDSPdfInput {
  numero: string
  emitidoEm: Date
  operador: { nome: string; cnpj: string; endereco: string }
  produto: { cultura: string; ncm: string; qtdToneladas: number }
  propriedades: Array<{
    nome: string
    car?: string | null
    carStatus?: string | null
    areaHa?: number | null
    municipio?: string | null
    uf?: string | null
    centroideLat?: number | null
    centroideLng?: number | null
    embargoIbama?: boolean
    sobreposicaoTI?: boolean
    sobreposicaoUC?: boolean
  }>
  lotes: Array<{ numero: string; qtdSc: number; talhoesOrigem?: string[] }>
  risco: { nivel: 'baixo' | 'medio' | 'alto' | 'critico'; fatores: Array<{ descricao: string; gravidade: string }> }
  contratoNumero?: string
  observacoes?: string | null
  hash?: string
}

function riscoStyle(nivel: string) {
  if (nivel === 'critico') return styles.riskCritico
  if (nivel === 'alto') return styles.riskAlto
  if (nivel === 'medio') return styles.riskMedio
  return styles.riskBaixo
}

function DDSDocument({ input }: { input: DDSPdfInput }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Due Diligence Statement (EUDR)</Text>
          <Text style={styles.subtitle}>
            Regulamento (UE) 2023/1115 — Annex II · DDS Nº {input.numero} ·
            Emitido em {input.emitidoEm.toLocaleString('pt-BR')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>1. Operador (Exportador)</Text>
          <View style={styles.row}><Text style={styles.label}>Razão Social</Text><Text style={styles.value}>{input.operador.nome}</Text></View>
          <View style={styles.row}><Text style={styles.label}>CNPJ</Text><Text style={styles.value}>{input.operador.cnpj}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Endereço</Text><Text style={styles.value}>{input.operador.endereco}</Text></View>
          {input.contratoNumero ? (
            <View style={styles.row}><Text style={styles.label}>Contrato vinculado</Text><Text style={styles.value}>{input.contratoNumero}</Text></View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>2. Produto</Text>
          <View style={styles.row}><Text style={styles.label}>Cultura</Text><Text style={styles.value}>{input.produto.cultura}</Text></View>
          <View style={styles.row}><Text style={styles.label}>NCM</Text><Text style={styles.value}>{input.produto.ncm}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Quantidade (t)</Text><Text style={styles.value}>{input.produto.qtdToneladas.toLocaleString('pt-BR')}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>3. Cadeia de Custódia — Lotes e Talhões</Text>
          <View style={styles.table}>
            <View style={styles.th}>
              <Text style={styles.td}>Lote</Text>
              <Text style={styles.td}>Qtd (sc)</Text>
              <Text style={{ ...styles.td, flex: 2 }}>Talhões origem</Text>
            </View>
            {input.lotes.map((l, i) => (
              <View key={i} style={styles.tr}>
                <Text style={styles.td}>{l.numero}</Text>
                <Text style={styles.td}>{l.qtdSc.toLocaleString('pt-BR')}</Text>
                <Text style={{ ...styles.td, flex: 2 }}>{(l.talhoesOrigem || []).join(', ') || '—'}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>4. Propriedades de Origem</Text>
          <View style={styles.table}>
            <View style={styles.th}>
              <Text style={styles.td}>Propriedade</Text>
              <Text style={styles.td}>CAR</Text>
              <Text style={styles.td}>Status CAR</Text>
              <Text style={styles.td}>Área (ha)</Text>
              <Text style={styles.td}>UF</Text>
              <Text style={{ ...styles.td, flex: 1.5 }}>Geo (lat,lng)</Text>
              <Text style={styles.td}>Alertas</Text>
            </View>
            {input.propriedades.map((p, i) => {
              const alertas = [
                p.embargoIbama ? 'IBAMA' : null,
                p.sobreposicaoTI ? 'TI' : null,
                p.sobreposicaoUC ? 'UC' : null,
              ].filter(Boolean).join(', ') || '—'
              return (
                <View key={i} style={styles.tr}>
                  <Text style={styles.td}>{p.nome}</Text>
                  <Text style={styles.td}>{p.car || '—'}</Text>
                  <Text style={styles.td}>{p.carStatus || '—'}</Text>
                  <Text style={styles.td}>{p.areaHa?.toLocaleString('pt-BR') || '—'}</Text>
                  <Text style={styles.td}>{p.uf || '—'}</Text>
                  <Text style={{ ...styles.td, flex: 1.5 }}>
                    {p.centroideLat && p.centroideLng
                      ? `${p.centroideLat.toFixed(4)}, ${p.centroideLng.toFixed(4)}`
                      : '—'}
                  </Text>
                  <Text style={styles.td}>{alertas}</Text>
                </View>
              )
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>5. Avaliação de Risco</Text>
          <View style={[styles.riskBox, riscoStyle(input.risco.nivel)]}>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>
              Nível de risco: {input.risco.nivel.toUpperCase()}
            </Text>
            {input.risco.fatores.length === 0 ? (
              <Text>Nenhum fator de risco identificado — propriedade(s) em conformidade com o EUDR.</Text>
            ) : (
              input.risco.fatores.map((f, i) => (
                <Text key={i}>· [{f.gravidade}] {f.descricao}</Text>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>6. Medidas de Mitigação</Text>
          <Text>
            O operador declara ter realizado due diligence conforme Art. 8 do Regulamento (UE) 2023/1115,
            incluindo (a) coleta de informações e dados das propriedades; (b) avaliação de risco; (c) medidas
            mitigatórias quando aplicável. O operador atesta sob as penas da lei que a mercadoria descrita
            neste DDS é livre de desmatamento (cutoff 31/12/2020) e produzida em conformidade com a
            legislação do país de origem.
          </Text>
        </View>

        {input.observacoes ? (
          <View style={styles.section}>
            <Text style={styles.h2}>7. Observações</Text>
            <Text>{input.observacoes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          DDS {input.numero} · Hash SHA-256: {input.hash || 'pendente'} · Documento gerado eletronicamente
          pelo sistema BH Grain · {new Date().getFullYear()}
        </Text>
      </Page>
    </Document>
  )
}

export async function renderDDSPdf(input: DDSPdfInput): Promise<Buffer> {
  const buf = await pdf(<DDSDocument input={input} />).toBuffer()
  // toBuffer pode retornar NodeJS.ReadableStream em algumas versões — normaliza:
  if (Buffer.isBuffer(buf)) return buf
  return await streamToBuffer(buf as any)
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    stream.on('data', (c: Buffer) => chunks.push(c))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}
