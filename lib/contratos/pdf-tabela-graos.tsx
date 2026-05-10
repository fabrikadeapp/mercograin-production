import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'

export interface ItemGrao {
  grao: string // 'soja' | 'milho' | 'trigo' | outros
  quantidadeSc: number
  precoSc: number // R$ por saca
}

const SACA_KG = 60

const grainColors: Record<string, string> = {
  soja: '#0a8a3a',
  milho: '#d4a017',
  trigo: '#a06a3c',
}

const grainLabels: Record<string, string> = {
  soja: 'Soja',
  milho: 'Milho',
  trigo: 'Trigo',
}

const styles = StyleSheet.create({
  table: {
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
  },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  rowHeader: { backgroundColor: '#f5f5f5', borderBottomWidth: 1 },
  rowFooter: {
    backgroundColor: '#fafafa',
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: '#0a8a3a',
  },
  cell: { padding: 8, fontSize: 9 },
  cellHeader: { fontWeight: 700, fontSize: 9, color: '#555' },
  cellGrao: { width: '20%' },
  cellQtd: { width: '25%', textAlign: 'right' },
  cellPreco: { width: '25%', textAlign: 'right' },
  cellSubtotal: { width: '30%', textAlign: 'right', fontWeight: 600 },
  grainBadge: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  grainCell: { flexDirection: 'row', alignItems: 'center' },
  total: { fontSize: 11, fontWeight: 700 },
})

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function PdfTabelaGraos({ items }: { items: ItemGrao[] }) {
  if (!items || items.length === 0) return null

  const totalGeral = items.reduce(
    (s, i) => s + (Number(i.quantidadeSc) || 0) * (Number(i.precoSc) || 0),
    0
  )

  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.rowHeader]}>
        <Text style={[styles.cell, styles.cellHeader, styles.cellGrao]}>Grão</Text>
        <Text style={[styles.cell, styles.cellHeader, styles.cellQtd]}>Quantidade</Text>
        <Text style={[styles.cell, styles.cellHeader, styles.cellPreco]}>Preço (R$/sc)</Text>
        <Text style={[styles.cell, styles.cellHeader, styles.cellSubtotal]}>Subtotal</Text>
      </View>
      {items.map((it, idx) => {
        const qtd = Number(it.quantidadeSc) || 0
        const preco = Number(it.precoSc) || 0
        const subtotal = qtd * preco
        const ton = (qtd * SACA_KG) / 1000
        const grainKey = String(it.grao || '').toLowerCase()
        const color = grainColors[grainKey] || '#999'
        const label = grainLabels[grainKey] || it.grao || '—'
        return (
          <View key={idx} style={styles.row}>
            <View style={[styles.cell, styles.cellGrao, styles.grainCell]}>
              <View style={[styles.grainBadge, { backgroundColor: color }]} />
              <Text>{label}</Text>
            </View>
            <Text style={[styles.cell, styles.cellQtd]}>
              {qtd.toLocaleString('pt-BR')} sc · {fmt(ton)} t
            </Text>
            <Text style={[styles.cell, styles.cellPreco]}>R$ {fmt(preco)}</Text>
            <Text style={[styles.cell, styles.cellSubtotal]}>R$ {fmt(subtotal)}</Text>
          </View>
        )
      })}
      <View style={[styles.row, styles.rowFooter]}>
        <Text style={[styles.cell, styles.cellGrao, styles.total]}>Total</Text>
        <Text style={[styles.cell, styles.cellQtd]}> </Text>
        <Text style={[styles.cell, styles.cellPreco]}> </Text>
        <Text style={[styles.cell, styles.cellSubtotal, styles.total]}>R$ {fmt(totalGeral)}</Text>
      </View>
    </View>
  )
}
